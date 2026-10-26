#!/bin/bash
# crop.sh <in.png> <out.png> x y w h [scale]: قصّ منطقة بشبكة كل 25 بكسل وأرقام كل 50 بإحداثيات الصورة الأصلية
in="$1"; out="$2"; X=$3; Y=$4; W=$5; H=$6; S=${7:-2}
draw=()
for ((x=(X/25)*25; x<=X+W; x+=25)); do (( x < X )) && continue
  if (( x % 50 == 0 )); then c='rgba(255,0,0,0.55)'; else c='rgba(0,140,0,0.3)'; fi
  draw+=(-stroke "$c" -draw "line $(( (x-X)*S )),0 $(( (x-X)*S )),$((H*S))"); done
for ((y=(Y/25)*25; y<=Y+H; y+=25)); do (( y < Y )) && continue
  if (( y % 50 == 0 )); then c='rgba(255,0,0,0.55)'; else c='rgba(0,140,0,0.3)'; fi
  draw+=(-stroke "$c" -draw "line 0,$(( (y-Y)*S )) $((W*S)),$(( (y-Y)*S ))"); done
txt=()
for ((x=((X+49)/50)*50; x<=X+W; x+=50)); do txt+=(-draw "text $(( (x-X)*S+2 )),14 '$x'"); done
for ((y=((Y+49)/50)*50; y<=Y+H; y+=50)); do txt+=(-draw "text 2,$(( (y-Y)*S-3 )) '$y'"); done
convert "$in" -crop ${W}x${H}+${X}+${Y} +repage -background '#d8c8a8' -flatten -filter point -resize $((S*100))% \
  "${draw[@]}" -stroke none -fill black -pointsize 13 "${txt[@]}" "$out"
