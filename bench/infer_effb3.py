# รัน dieline_effb3.pt บน gold set 9 ใบ + เทียบ proxy/Claude/CV-เก่า/GPT
#   รันที่ไหนก็ได้ที่ torch โหลดได้ (เช่น Colab) — local MS-Store Python โหลด torch DLL ไม่ได้
#   Colab: อัปโหลด .pt + โฟลเดอร์ bench/gold/img/ แล้ว !python infer_effb3.py
import torch, timm, io, os, sys
from PIL import Image, ImageChops
import torch.nn.functional as F

PT = 'dieline_effb3 (1).pt'          # ปรับ path ตามที่วางไฟล์
IMGDIR = 'bench/gold/img'            # โฟลเดอร์รูป gold (img/NN.png = adjudication #NN)
PX = 384
ACTIVE = [1,2,3,4,5,7,8,9,10,11,12]  # คลาสที่โมเดลรู้จัก (ตัดคลาส 6) — idx -> class
idx2cls = {i:c for i,c in enumerate(ACTIVE)}
MEAN=[0.485,0.456,0.406]; STD=[0.229,0.224,0.225]

# gold set + ผลวิธีอื่น (จาก bench/gold/gold_adjudication.md) — img#: (สินค้า, gold, proxy, claude, cv_old, gpt)
GOLD = {
  1: ('FETTUCCINE', 1, 1, 1, 3, 12),
  3: ('ZOE',        2, 2, 1, 2, 1),
  7: ('1649',       1, 1, 1, 1, 1),
  8: ('Oat',        1, 1, 1, 1, 12),
  9: ('GPO DICLOX', 12, 4, 11, 4, 11),
  13:('THE GENT',   12, 1, 4, 12, 12),
  17:('Sleeve',     9, 9, 9, 3, 9),
  19:('NATUR',      12, 3, 4, 3, 12),
}

def trim(im):
    bg=Image.new('RGB',im.size,(255,255,255)); bb=ImageChops.difference(im,bg).getbbox()
    if bb:
        w,h=im.size; mx=max(2,int((bb[2]-bb[0])*0.03)); my=max(2,int((bb[3]-bb[1])*0.03))
        im=im.crop((max(0,bb[0]-mx),max(0,bb[1]-my),min(w,bb[2]+mx),min(h,bb[3]+my)))
    return im
def preprocess(path):
    im=trim(Image.open(path).convert('RGB'))
    im.thumbnail((PX,PX)); bg=Image.new('RGB',(PX,PX),(255,255,255))
    bg.paste(im,((PX-im.width)//2,(PX-im.height)//2))
    import numpy as np
    a=np.asarray(bg,dtype='float32')/255.0
    a=(a-MEAN)/STD; a=a.transpose(2,0,1)
    return torch.from_numpy(a).unsqueeze(0).float()

# โหลดโมเดล
sd=torch.load(PT, map_location='cpu', weights_only=True)
if isinstance(sd,dict) and 'state_dict' in sd: sd=sd['state_dict']
model=timm.create_model('efficientnet_b3', pretrained=False, num_classes=len(ACTIVE))
model.load_state_dict(sd); model.eval()

def predict(path):
    with torch.no_grad():
        p=F.softmax(model(preprocess(path)),1)[0]
    top=torch.topk(p,3)
    return [(idx2cls[int(i)], float(v)) for v,i in zip(top.values,top.indices)]

print(f'{"สินค้า":<14}{"gold":>5}{"CNN-new":>9}{"conf":>7}{"top3":>16}  proxy claude cv gpt')
print('-'*80)
hit={'cnn':0,'proxy':0,'claude':0,'cv':0,'gpt':0}; n=0
for num,(name,gold,proxy,claude,cv,gpt) in GOLD.items():
    path=os.path.join(IMGDIR,f'{num:02d}.png')
    if not os.path.exists(path): print(f'{name:<14} (ไม่พบรูป {path})'); continue
    top=predict(path); pred=top[0][0]; conf=top[0][1]; n+=1
    t3=' '.join(f'{c}:{v:.0%}' for c,v in top)
    ok='✓' if pred==gold else '✗'
    for k,v in [('cnn',pred),('proxy',proxy),('claude',claude),('cv',cv),('gpt',gpt)]:
        if v==gold: hit[k]+=1
    print(f'{name:<14}{gold:>5}{str(pred)+ok:>9}{conf:>6.0%}  {t3:<16}  {proxy:>5}{claude:>6}{cv:>4}{gpt:>4}')
print('-'*80)
print(f'ความแม่น (จาก {n} ใบ):  CNN-new {hit["cnn"]}/{n}  |  proxy {hit["proxy"]}/{n}  claude {hit["claude"]}/{n}  cv-เก่า {hit["cv"]}/{n}  gpt {hit["gpt"]}/{n}')
