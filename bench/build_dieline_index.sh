#!/bin/bash
# ดึงข้อความจากทุก PDF ใน test/uploads → กู้ F-code + Job Name + type-hint (ฟรี ไม่ใช้ AI)
# ผลออกเป็น CSV: bench/dieline_index.csv
cd "$(dirname "$0")/../test/uploads" || exit 1
OUT="../../bench/dieline_index.csv"
printf 'file\tfcode\tjob_name\ttype_hint\tstatus\n' > "$OUT"
total=0; named=0; empty=0; noname=0
while IFS= read -r -d '' f; do
	f="${f#./}"
	total=$((total+1))
	txt=$(timeout 20 pdftotext -f 1 -l 2 "$f" - 2>/dev/null)
	code=$(printf '%s' "$txt" | grep -oiE 'F[0-9]{6}' | head -1)
	job=$(printf '%s' "$txt" | grep -oiE 'Job Name:[[:space:]]*[^\r\n]*' | head -1 | sed -E 's/^Job Name:[[:space:]]*//I' | tr -d '"\t' | cut -c1-70)
	hint=$(printf '%s' "$txt" | grep -oiE 'INNERBOX|INNER|TRAY|COVER|PARTITION|CUSHION|CARTON|TABLET|DISPLAY|SLEEVE|PILLOW|GABLE|PIZZA|MASK|SLEEVE|กล่องยา|กล่อง|ยาน้ำ|ยาเม็ด|ถาด|ฝาครอบ|ปลอก|BOX' | head -1)
	if [ -n "$code" ] || [ -n "$job" ]; then named=$((named+1)); status=named;
	elif [ ${#txt} -lt 10 ]; then empty=$((empty+1)); status=image-only;
	else noname=$((noname+1)); status=text-noname; fi
	printf '%s\t%s\t%s\t%s\t%s\n' "$f" "$code" "$job" "$hint" "$status" >> "$OUT"
	if [ $((total % 500)) -eq 0 ]; then printf 'progress: %s done (named=%s)\n' "$total" "$named"; fi
done < <(find . -maxdepth 1 -type f -iname '*.pdf' -print0)
printf '\nDONE: total=%s  named=%s  image-only=%s  text-noname=%s\n' "$total" "$named" "$empty" "$noname"
printf 'index → bench/dieline_index.csv\n'
