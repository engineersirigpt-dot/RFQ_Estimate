#!/bin/bash
# แยกกลุ่ม text-noname (2266) → ไดไลน์จริง vs เอกสารธุรกิจ(ทิ้ง) + ดึงโค้ด/มิติ
cd "$(dirname "$0")/../test/uploads" || exit 1
OUT="../../bench/noname_refined.csv"
IDX="../../bench/dieline_index.csv"
printf 'file\tkind\tcode\tsize_hint\n' > "$OUT"
dieline=0; quote=0; other=0; n=0
# อ่านรายชื่อ text-noname จาก index
awk -F'\t' '$5=="text-noname"{print $1}' "$IDX" | while IFS= read -r f; do
	[ -e "$f" ] || continue
	n=$((n+1))
	txt=$(timeout 15 pdftotext -f 1 -l 1 "$f" - 2>/dev/null)
	# โค้ดอ้างอิง (RFQ/quote)
	code=$(printf '%s' "$txt" | grep -oiE 'RFQ:?[[:space:]]*[A-Z0-9]{4,}|QH[0-9]{6,}|[EＥ][0-9]{8,}|PGT[A-Z0-9]+' | head -1 | tr -d '\r\t"')
	# มิติ (เช่น 23.5" x 41")
	size=$(printf '%s' "$txt" | grep -oiE '[0-9]+(\.[0-9]+)?"?[[:space:]]*[xX][[:space:]]*[0-9]+(\.[0-9]+)?"?' | head -1 | tr -d '\r\t"')
	if printf '%s' "$txt" | grep -qiE 'ใบเสนอราคา|quotation|quotePage|FM-72[0-9]|Sirivatana Interprint|Telephone|Sales Office'; then
		kind=doc-quotation; quote=$((quote+1))
	elif printf '%s' "$txt" | grep -qiE 'Cut|Crease|Perforate|LAY|Folded size|Open size|TTs|Duplex|gsm|die.?cut|กาว|พับ|ไดคัท'; then
		kind=dieline; dieline=$((dieline+1))
	else
		kind=other; other=$((other+1))
	fi
	printf '%s\t%s\t%s\t%s\n' "$f" "$kind" "$code" "$size" >> "$OUT"
	if [ $((n % 400)) -eq 0 ]; then printf 'progress %s\n' "$n"; fi
done
echo "DONE"
awk -F'\t' 'NR>1{c[$2]++} END{for(k in c)printf "  %-16s %s\n",k,c[k]}' "$OUT"
printf 'refined → bench/noname_refined.csv\n'
