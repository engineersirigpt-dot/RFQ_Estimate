# Ingest GPT blind labels → map num→file, join proxy, หา custom false-negative ที่ยืนยัน
# ออก: labeled.tsv (ครบทุกใบ) + expert_shortlist.tsv (เฉพาะที่ต้องคน confirm)
# python bench/ingest_fn_labels.py [results.json] [manifest.tsv]
import json, sys, csv, collections

RES=sys.argv[1] if len(sys.argv)>1 else 'bench/label_queue/GPT-FN-BLIND-RESULTS.json'
MAN=sys.argv[2] if len(sys.argv)>2 else 'bench/label_queue/nn_gold_manifest.tsv'
CAND='bench/label_queue/fn_candidates.tsv'
OUT='bench/label_queue'

# num -> (file, family)
man={int(r[0]):(r[1],r[2]) for r in [l.rstrip('\n').split('\t') for l in open(MAN,encoding='utf-8')][1:]}
# file -> proxy (from candidates)
crows=[l.rstrip('\n').split('\t') for l in open(CAND,encoding='utf-8')]; ch=crows[0]; ci=lambda r,n:r[ch.index(n)]
proxy={ci(r,'file'):(ci(r,'proxy'),ci(r,'proxy_name')) for r in crows[1:]}
gpt=json.load(open(RES,encoding='utf-8'))

STD={'1','2','3','4','11'}
rows=[]; fn=0; conflict_amb=0; agree_std=0
for g in sorted(gpt,key=lambda x:x['num']):
    n=g['num']; f,fam=man[n]; px,pxn=proxy.get(f,('?','?'))
    isc=g.get('is_custom'); bs=g.get('base_status'); bc=g.get('base_construction')
    reasons='|'.join(g.get('custom_reasons') or [])
    cands='|'.join(str(x) for x in (g.get('base_candidates') or []))
    # flags
    is_fn = (isc=='yes' and px in STD)                       # proxy=std แต่ GPT=custom → false-negative
    base_conflict = (bs=='standard' and bc is not None and str(bc)!=px)  # base ไม่ตรง proxy
    needs_expert = is_fn or bs in ('ambiguous','nonstandard') or isc=='unknown'
    if is_fn: fn+=1
    if bs in ('ambiguous','nonstandard'): conflict_amb+=1
    if isc=='no' and bs=='standard' and str(bc)==px: agree_std+=1
    rows.append([n,f,fam,px,pxn,isc,reasons,bs,('' if bc is None else str(bc)),cands,
                 'Y' if is_fn else '','Y' if base_conflict else '','Y' if needs_expert else '',
                 g.get('evidence','')])

HDR=['num','file','family_group_id','proxy','proxy_name','gpt_is_custom','gpt_custom_reasons',
     'gpt_base_status','gpt_base_construction','gpt_base_candidates','is_false_negative',
     'base_conflict','needs_expert','gpt_evidence']
csv.writer(open(OUT+'/nn_gold_labeled.tsv','w',newline='',encoding='utf-8'),delimiter='\t').writerows([HDR]+rows)
short=[r for r in rows if r[12]=='Y']
csv.writer(open(OUT+'/expert_shortlist.tsv','w',newline='',encoding='utf-8'),delimiter='\t').writerows([HDR]+short)

# ---------- report ----------
isc_c=collections.Counter(r[5] for r in rows); bs_c=collections.Counter(r[7] for r in rows)
px_of_custom=collections.Counter(r[4] for r in rows if r[5]=='yes')
print(f'ingest {len(rows)} ใบ (nn_gold)')
print(f'  is_custom: {dict(isc_c)}')
print(f'  base_status: {dict(bs_c)}')
print(f'  🎯 false-negative (proxy=std แต่ GPT=custom): {fn}/{len(rows)} = {100*fn//len(rows)}%')
print(f'     proxy เดิมของ FN พวกนี้: {dict(px_of_custom)}')
print(f'  agree-standard (GPT ยืนยันตรง proxy): {agree_std}')
print(f'  → expert_shortlist: {len(short)} ใบ (FN {fn} + ambiguous/nonstandard {conflict_amb} + unknown)')
print(f'  ไฟล์: {OUT}/nn_gold_labeled.tsv + {OUT}/expert_shortlist.tsv')
