/* 使用 HEX 计算感知色差，避免原始 RGB 字段与色值不一致。 */
function describeColor(color) {
  const rgb = color.hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255);
  const [r, g, b] = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const l = Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b);
  const m = Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b);
  const s = Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
  const L = 0.2104542553*l + 0.793617785*m - 0.0040720468*s;
  const a = 1.9779984951*l - 2.428592205*m + 0.4505937099*s;
  const bLab = 0.0259040371*l + 0.7827717662*m - 0.808675766*s;
  return {...color, L, a, b: bLab, C: Math.hypot(a, bLab), h: Math.atan2(bLab, a), lum: 0.2126*r + 0.7152*g + 0.0722*b};
}
function contrast(a, b) { return (Math.max(a.lum, b.lum) + 0.05) / (Math.min(a.lum, b.lum) + 0.05); }
function distance(a, b) { return Math.hypot(a.L-b.L, a.a-b.a, a.b-b.b); }
function target(L, C, h) { return {L, a: C*Math.cos(h), b: C*Math.sin(h)}; }

function previewSurface(primary, catalog, variant = 0) {
  const hue = primary.C < 0.025 ? 1.5 : primary.h;
  const shift = [0, 0.045, -0.04, 0.08][variant % 4];
  const nearest = (colors, aim) => colors.reduce((best,c)=>distance(c,aim)<distance(best,aim)?c:best);
  const background = nearest(catalog.filter(c=>c.L>0.88 && c.hex!==primary.hex),target(0.97-Math.abs(shift)/3,0.015,hue));
  const foreground = nearest(catalog.filter(c=>c.hex!==primary.hex && contrast(c,background)>=4.5),target(0.27+shift,0.025,hue));
  return {background,foreground};
}
const styles = [
  {name: '同色层次', offset: 0, accent: 0, hint: '用明暗与浓淡，延续同一种色彩情绪。'},
  {name: '邻近柔和', offset: 30, accent: -35, hint: '让相邻色相自然过渡，适合温和的视觉表达。'},
  {name: '互补点睛', offset: 15, accent: 180, hint: '以对向色相点缀，强调色适合少量使用。'},
  {name: '三角色配色', offset: 120, accent: 240, balanced: true, hint: '围绕主色，在约 120° 与 240° 方向寻找搭配。'},
  {name: '分裂互补色', offset: 150, accent: 210, balanced: true, hint: '在主色互补方向的两侧，寻找约 150° 与 210° 的搭配。'},
  {name: '聚类选色', algorithm: 'cluster', hint: '将整份色库分组，提取各组代表色，不受当前主色影响。'},
  {name: '最大色差选色', algorithm: 'farthest', hint: '从主色出发，每次挑选与已选颜色最不相近的颜色。'},
  {name: '色相等分配色', algorithm: 'equal-hue', hint: '以主色为起点，按颜色数量等分色相圆，匹配色库中的近似颜色。'}
];

function uniqueColors(catalog) {
  return [...new Map(catalog.map(c => [c.hex.toLowerCase(), c])).values()];
}

function farthestPalette(base, catalog, count) {
  const pool = uniqueColors(catalog);
  const chosen = [base];
  const used = new Set([base.hex.toLowerCase()]);
  const nearest = pool.map(c => distance(c, base));
  while (chosen.length < count) {
    let next = -1;
    for (let i = 0; i < pool.length; i++) {
      if (!used.has(pool[i].hex.toLowerCase()) && (next < 0 || nearest[i] > nearest[next])) next = i;
    }
    if (next < 0) throw new Error('色库中不同颜色的数量不足');
    const color = pool[next];
    chosen.push(color);
    used.add(color.hex.toLowerCase());
    pool.forEach((c,i) => { nearest[i] = Math.min(nearest[i], distance(c,color)); });
  }
  return chosen;
}

function clusterPalette(catalog, count, variant = 0) {
  const pool = uniqueColors(catalog);
  // 使用固定起点与最远点初始化，保证同一版本可复现。
  const seed = pool[Math.floor((variant % 4)*pool.length/4)];
  let centers = farthestPalette(seed, pool, count).map(c => ({L:c.L, a:c.a, b:c.b}));
  for (let iteration = 0; iteration < 60; iteration++) {
    const groups = centers.map(() => []);
    for (const color of pool) {
      let nearest = 0;
      for (let i = 1; i < centers.length; i++) {
        if (distance(color,centers[i]) < distance(color,centers[nearest])) nearest = i;
      }
      groups[nearest].push(color);
    }
    const updated = groups.map((group,i) => {
      if (!group.length) return centers[i];
      return {L:group.reduce((sum,c)=>sum+c.L,0)/group.length, a:group.reduce((sum,c)=>sum+c.a,0)/group.length, b:group.reduce((sum,c)=>sum+c.b,0)/group.length};
    });
    const movement = Math.max(...updated.map((c,i)=>distance(c,centers[i])));
    centers = updated;
    if (movement < 0.00001) break;
  }
  // 聚类中心可能不在色库中，映射回最近的未使用原始颜色。
  const used = new Set();
  return centers.map(center => {
    const candidates = pool.filter(c=>!used.has(c.hex.toLowerCase()));
    const color = candidates.reduce((best,c)=>distance(c,center)<distance(best,center)?c:best);
    used.add(color.hex.toLowerCase());
    return color;
  }).sort((a,b)=>a.L-b.L);
}

function equalHuePalette(base, catalog, count, variant = 0) {
  const palette = [base];
  const used = new Set([base.hex.toLowerCase()]);
  const pool = uniqueColors(catalog);
  const hue = base.C < 0.025 ? 0 : base.h;
  const shift = [0, 0.045, -0.04, 0.08][variant % 4];
  const lightness = Math.max(0.45, Math.min(0.8, base.L)) + shift;
  const chroma = Math.max(0.08, Math.min(0.18, base.C));
  for (let i = 1; i < count; i++) {
    const angle = hue + 2*Math.PI*i/count;
    const aim = target(lightness, chroma, angle);
    const remaining = pool.filter(c => !used.has(c.hex.toLowerCase()));
    if (!remaining.length) throw new Error('色库中不同颜色的数量不足');
    // 避免将近中性色当作目标色相；色相距离同时考虑跨越零度的情况。
    const colorful = remaining.filter(c => c.C >= 0.025);
    const candidates = colorful.length ? colorful : remaining;
    const score = c => distance(c, aim) + 0.18*Math.abs(Math.atan2(Math.sin(c.h-angle), Math.cos(c.h-angle)));
    const color = candidates.reduce((best,c) => score(c) < score(best) ? c : best);
    palette.push(color);
    used.add(color.hex.toLowerCase());
  }
  return palette;
}

function makeScheme(base, style, catalog, variant = 0, count = 5) {
  if (!Number.isInteger(count) || count < 2 || count > 10) throw new Error('颜色数量必须是 2 到 10 之间的整数');
  if (style.algorithm === 'cluster') return clusterPalette(catalog, count, variant);
  if (style.algorithm === 'farthest') return farthestPalette(base, catalog, count);
  if (style.algorithm === 'equal-hue') return equalHuePalette(base, catalog, count, variant);
  const used = new Set([base.hex.toLowerCase()]);
  function pick(aim, filter = () => true) {
    const candidates = catalog.filter(c => !used.has(c.hex.toLowerCase()) && filter(c));
    candidates.sort((a,b) => distance(a, aim)-distance(b, aim));
    if (!candidates.length) throw new Error('色库中没有符合条件的搭配颜色');
    const chosen = candidates[0];
    used.add(chosen.hex.toLowerCase());
    return chosen;
  }
  const h = base.C < 0.025 ? 1.5 : base.h;
  const shift = [0, 0.045, -0.04, 0.08][variant % 4];
  const background = pick(target(0.97 - Math.abs(shift)/3, 0.015, h), c => c.L > 0.88);
  const text = pick(target(0.27 + shift, 0.025, h), c => contrast(c, background) >= 4.5);
  const auxiliary = pick(target(style.balanced ? 0.63 + shift : base.L > 0.62 ? 0.47 + shift : 0.77 + shift, style.balanced ? Math.min(Math.max(base.C, 0.1), 0.19) : Math.min(Math.max(base.C*0.65, 0.045), 0.12), h + style.offset*Math.PI/180), c => distance(c, base) > 0.08);
  const accent = pick(target(style.accent === 0 ? (base.L > 0.6 ? 0.35 : 0.65) + shift : 0.63 + shift, Math.min(Math.max(base.C, 0.1), 0.19), h + style.accent*Math.PI/180), c => distance(c, base) > 0.1 && distance(c, auxiliary) > 0.07);
  if (count === 2) return [base, accent];
  const palette = [base, auxiliary, accent, background, text].slice(0, count);
  for (let i = 5; i < count; i++) {
    const step = i - 5;
    const extraHue = h + (step % 2 === 0 ? style.offset : style.accent)*Math.PI/180;
    palette.push(pick(target(0.4 + (step % 4)*0.13 + shift/2, Math.max(0.04, base.C*(step % 2 ? 0.55 : 0.85)), extraHue)));
  }
  return palette;
}

function schemeRoles(count, style = {}) {
  if (style.algorithm === 'equal-hue') return Array.from({length:count}, (_,i)=>i === 0 ? '主色' : `目标 +${Number((360*i/count).toFixed(1))}°`);
  if (style.algorithm === 'cluster') return Array.from({length:count}, (_,i)=>`代表色 ${i+1}`);
  if (style.algorithm === 'farthest') return Array.from({length:count}, (_,i)=>i === 0 ? '主色' : `区分色 ${i}`);
  if (count === 2) return ['主色', '强调色'];
  return Array.from({length: count}, (_, i) => ['主色', '辅助色', '强调色', '背景色', '文字色'][i] || `扩展色 ${i-4}`);
}

// 色盘沿用配色算法的 OKLab 坐标：角度为色相，半径为彩度。
function wheelPoint(color) {
  return {x: 120 + color.a / 0.4 * 80, y: 120 - color.b / 0.4 * 80};
}

function zoomWheelView(view, factor, anchorX = 0.5, anchorY = 0.5) {
  const size = Math.max(22.5, Math.min(180, view.size / factor));
  // 保持指针下的坐标不动，并避免缩放后移出色盘范围。
  return {
    x: Math.max(30, Math.min(210 - size, view.x + (view.size - size)*anchorX)),
    y: Math.max(30, Math.min(210 - size, view.y + (view.size - size)*anchorY)),
    size
  };
}

function fullWheelMarkup() {
  let markup = '';
  // 使用与色库位置一致的坐标，底盘统一明度，仅作色相和彩度参考。
  for (let ring = 0; ring < 16; ring++) {
    const inner = ring * 5;
    const outer = inner + 5;
    for (let degree = 0; degree < 360; degree += 3) {
      const start = degree * Math.PI / 180;
      const end = (degree + 3) * Math.PI / 180;
      const point = (radius, angle) => `${120 + radius*Math.cos(angle)},${120 - radius*Math.sin(angle)}`;
      markup += `<path d="M ${point(inner,start)} L ${point(outer,start)} A ${outer},${outer} 0 0 0 ${point(outer,end)} L ${point(inner,end)} ${inner ? `A ${inner},${inner} 0 0 1 ${point(inner,start)}` : ''} Z" fill="oklch(0.75 ${(ring+0.5)*0.025} ${degree+1.5})"/>`;
    }
  }
  return markup;
}

function bindWheelHold(button, setVisible, host = window, page = document) {
  let pointer = null;
  let key = null;
  const update = () => setVisible(pointer !== null || key !== null);
  const reset = () => { pointer = null; key = null; update(); };
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer !== null) return;
    pointer = event.pointerId;
    button.setPointerCapture(pointer);
    update();
  });
  const release = event => {
    if (event.pointerId === pointer) { pointer = null; update(); }
  };
  host.addEventListener('pointerup', release);
  host.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('keydown', event => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      key = event.key;
      update();
    }
  });
  button.addEventListener('keyup', event => {
    if (event.key === key) { event.preventDefault(); key = null; update(); }
  });
  button.addEventListener('contextmenu', event => event.preventDefault());
  button.addEventListener('blur', reset);
  host.addEventListener('blur', reset);
  page.addEventListener('visibilitychange', () => { if (page.hidden) reset(); });
  return reset;
}
function renderWheel(palette, roles, escapeText) {
  const positions = palette.map((color, index) => {
    const angle = -Math.PI/2 + index*2*Math.PI/palette.length;
    return {color, point: wheelPoint(color), label: {x:120+106*Math.cos(angle), y:120+106*Math.sin(angle)}};
  });
  const lines = positions.map(({point,label}) => `<line x1="${point.x}" y1="${point.y}" x2="${label.x}" y2="${label.y}" stroke="#333" stroke-opacity=".45" stroke-width=".8"/>`).join('');
  const dots = positions.map(({color,point},i) => `<circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${color.hex}" stroke="${color.lum > 0.179 ? '#000' : '#fff'}" stroke-width="1.5"><title>${escapeText(`${i+1} · ${roles[i]} · ${color.name} ${color.hex}`)}</title></circle>`).join('');
  const labels = positions.map(({color,label},i) => {
    const hue = color.C < 0.003 ? '近中性色，色相不明显' : `色相 ${((color.h*180/Math.PI+360)%360).toFixed(1)}°`;
    const description = `${i+1} · ${roles[i]} · ${color.name} ${color.hex.toUpperCase()} · ${hue} · 彩度 ${color.C.toFixed(3)} · 明度 ${color.L.toFixed(3)}`;
    return `<button type="button" class="wheel-marker" data-hex="${color.hex}" style="left:${label.x/2.4}%;top:${label.y/2.4}%;background:${color.hex};color:${color.lum > 0.179 ? '#000' : '#fff'}" title="${escapeText(description)}" aria-label="${escapeText(description)}，点击复制色值">${i+1}</button>`;
  }).join('');
  return `<figure class="color-wheel"><figcaption>色盘位置 <span>编号对应上方色卡</span></figcaption><div class="wheel-plot"><svg viewBox="0 0 240 240" role="img" aria-label="仅展示方案颜色的色相与彩度位置，背景透明，实心点为实际位置，连线通向外围编号"><circle cx="120" cy="120" r="80" fill="none" stroke="#b8bdb5"/><circle cx="120" cy="120" r="40" fill="none" stroke="#cdd1c9" stroke-dasharray="2 3"/><path d="M 40 120 H 200 M 120 40 V 200" fill="none" stroke="#d9ddd5" stroke-width=".6"/>${lines}${dots}</svg>${labels}</div></figure>`;
}

// 使用感知色差选择热图默认配色。
function defaultHeatmapIndices(palette, count = 3) {
  const colors = palette.map(describeColor);
  const size = Math.min(count, colors.length);
  let best = [], bestMin = -1, bestSum = -1;
  // 穷举组合，优先最大化最小两两色差，再以总色差打破平局。
  function visit(indices, start) {
    if (indices.length === size) {
      const distances = indices.flatMap((a,i)=>indices.slice(i+1).map(b=>distance(colors[a],colors[b])));
      const minimum = distances.length ? Math.min(...distances) : 0;
      const sum = distances.reduce((a,b)=>a+b,0);
      if (minimum > bestMin || (minimum === bestMin && sum > bestSum)) {
        best = indices.slice(); bestMin = minimum; bestSum = sum;
      }
      return;
    }
    for (let i = start; i <= colors.length-(size-indices.length); i++) visit([...indices,i],i+1);
  }
  visit([],0);
  return best.sort((a,b)=>colors[a].L-colors[b].L || a-b);
}

// 按等距颜色节点进行 RGB 分段线性插值，喵~
function sampleCmap(colors, value) {
  const position = Math.max(0, Math.min(1, value)) * (colors.length-1);
  const index = Math.min(Math.floor(position), colors.length-2);
  const fraction = position-index;
  return '#' + [1,3,5].map(offset => {
    const low = parseInt(colors[index].slice(offset,offset+2),16);
    const high = parseInt(colors[index+1].slice(offset,offset+2),16);
    return Math.round(low+(high-low)*fraction).toString(16).padStart(2,'0');
  }).join('');
}

function heatmapMarkup(palette, indices, escapeText, categories) {
  if (palette.length < 2) return '<div class="application-chart"><h4>热图</h4><p class="application-empty">请向当前方案添加至少 2 种颜色，以生成渐变热图。</p></div>';
  const colors = indices.map(i=>palette[i].hex);
  const labels = indices.length === 3 ? ['低值颜色','中间颜色','高值颜色'] : ['低值颜色','高值颜色'];
  const controls = indices.map((selected,slot)=>`<div class="heatmap-color-field"><span>${labels[slot]}</span><details class="heatmap-color-picker" data-heatmap-picker="${slot}"><summary aria-label="${labels[slot]}：${escapeText(palette[selected].name)}"><i aria-hidden="true" style="background:${palette[selected].hex}"></i><span>${escapeText(palette[selected].name)}</span></summary><div class="heatmap-color-options" role="group" aria-label="${labels[slot]}">${palette.map((c,i)=>`<button type="button" data-heatmap-slot="${slot}" value="${i}" aria-pressed="${i === selected}"${indices.includes(i) && i !== selected ? ' disabled' : ''}><i aria-hidden="true" style="background:${c.hex}"></i><span>${escapeText(c.name)}</span></button>`).join('')}</div></details></div>`).join('');
  // 固定示例数据，让切换方案时可以直接比较配色效果。
  const values = [[12,28,45,68,82,100],[5,18,39,56,73,91],[22,42,61,79,96,65],[35,58,84,100,71,48],[0,16,33,52,69,87],[48,36,62,75,89,94],[65,72,58,83,91,100],[18,45,78,92,64,38],[32,51,46,69,85,97],[25,40,59,74,88,95]].slice(0,categories.length);
  const rows = categories;
  // 固定绘图区高度，按品类数量均分每行空间。
  const plotHeight = 150;
  const rowHeight = plotHeight / rows.length;

  const cells = values.map((row,y)=>`<text data-heatmap-row-label="${y}" x="20" y="${36+(y+0.5)*rowHeight}" dominant-baseline="middle" text-anchor="middle" fill="#62685f" font-size="11">${rows[y]}</text>`+row.map((value,x)=>`<rect data-heatmap-row="${y}" x="${38+x*37}" y="${36+y*rowHeight}" width="37" height="${rowHeight}" fill="${sampleCmap(colors,value/100)}" stroke="#fff" stroke-width="1"><title>${rows[y]} · ${x+1}月：${value}</title></rect>`).join('')).join('');
  const stops = colors.map((color,i)=>`<stop offset="${100*i/(colors.length-1)}%" stop-color="${color}"/>`).join('');
  return `<div class="application-chart"><h4>品类月度表现热图 · 示例数据</h4><div class="heatmap-controls"><label>色数<select data-heatmap-count aria-label="渐变颜色数量"><option value="2"${indices.length === 2 ? ' selected' : ''}>2 色</option><option value="3"${indices.length === 3 ? ' selected' : ''}${palette.length < 3 ? ' disabled' : ''}>3 色</option></select></label>${controls}</div><svg data-heatmap-rows="${rows.length}" viewBox="0 0 320 ${plotHeight+36}" role="img" aria-label="${rows.length}个品类在六个月的表现热图，数值范围为 0 到 100"><defs><linearGradient id="heatmap-gradient" x1="0" y1="1" x2="0" y2="0" color-interpolation="sRGB">${stops}</linearGradient></defs>${values[0].map((_,i)=>`<text x="${56.5+i*37}" y="22" text-anchor="middle" fill="#62685f" font-size="11">${i+1}月</text>`).join('')}${cells}<rect x="273" y="36" width="12" height="${plotHeight}" fill="url(#heatmap-gradient)"/><g fill="#62685f" font-size="11" dominant-baseline="middle"><text x="290" y="${36+plotHeight}" dominant-baseline="auto">0</text><text x="290" y="${36+plotHeight/2}">50</text><text x="290" y="36">100</text></g></svg></div>`;
}

function applicationMarkup(palette, mode, escapeText, heatmapIndices = defaultHeatmapIndices(palette)) {
  if (!palette.length) return '<p class="application-empty">先在自定义配色中添加颜色，再来看看效果。</p>';
  const swatches = palette.map((c,i)=>`<span title="${escapeText(c.name)} ${c.hex.toUpperCase()}"><i style="background:${c.hex}"></i>${i+1} · ${escapeText(c.name)}</span>`).join('');
  if (mode === 'art') {
    const color = i => palette[i % palette.length].hex;
    const bands = palette.map((c,i)=>{
      const y = 290 + i*130/palette.length;
      return `<path d="M 0 ${y} Q 85 ${y-36} 180 ${y+5} T 360 ${y-10} V 460 H 0 Z" fill="${c.hex}"/>`;
    }).join('');
    return `<figure class="application-art"><svg viewBox="0 0 360 460" role="img" aria-label="山海之间，使用当前方案着色的山水插画"><rect width="360" height="460" fill="${palette.length === 1 ? '#f7f5f0' : color(palette.length-1)}"/><circle cx="258" cy="104" r="48" fill="${color(0)}"/><path d="M 0 230 L 94 102 L 226 272 L 360 156 V 460 H 0 Z" fill="${color(1)}" fill-opacity=".45"/><path d="M 0 279 L 169 161 L 360 310 V 460 H 0 Z" fill="${color(2)}" fill-opacity=".7"/><path d="M 0 305 Q 105 218 214 268 T 360 252 V 460 H 0 Z" fill="${color(3)}"/>${bands}<path d="M 43 346 Q 61 287 48 238 M 50 293 Q 22 280 27 253 Q 51 258 50 293 M 52 270 Q 79 257 76 233 Q 53 242 52 270" fill="${color(4)}" stroke="${color(4)}" stroke-width="3"/><path d="M 250 376 Q 268 348 298 365 Q 280 389 250 376" fill="${color(5)}"/><rect x="16" y="16" width="328" height="428" fill="none" stroke="${color(0)}" stroke-width="1"/></svg><figcaption>山海之间</figcaption></figure><div class="application-legend">${swatches}</div>`;
  }
  const values = [72,55,86,40,68,49,92,61,35,78].slice(0,palette.length);
  const categories = ['书籍','文具','家居','服饰','食品','运动','数码','园艺','玩具','手作'].slice(0,palette.length);
  const total = values.reduce((a,b)=>a+b,0);
  const circumference = 2*Math.PI*59;
  let offset = 0;
  const segments = palette.map((c,i)=>{
    const length = circumference*values[i]/total;
    const segment = `<circle cx="90" cy="90" r="59" fill="none" stroke="${c.hex}" stroke-width="26" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"><title>${categories[i]}：${(100*values[i]/total).toFixed(1)}%</title></circle>`;
    offset += length;
    return segment;
  }).join('');
  return `<div class="application-chart"><h4>品类占比 · 示例数据</h4><div class="application-donut-layout"><div class="application-donut"><svg viewBox="0 0 180 180" role="img" aria-label="各品类示例数据占比环形图">${segments}<text x="90" y="88" text-anchor="middle" fill="#292d29" font-size="22">${total}</text><text x="90" y="108" text-anchor="middle" fill="#73776f" font-size="11">合计</text></svg></div><div class="application-legend${palette.length > 5 ? ' is-two-columns' : ''}">${palette.map((c,i)=>`<span title="${escapeText(c.name)} ${c.hex.toUpperCase()}"><i style="background:${c.hex}"></i>${categories[i]}</span>`).join('')}</div></div></div>${heatmapMarkup(palette,heatmapIndices,escapeText,categories)}`;
}

function addCustomColor(colors, color) {
  if (colors.some(c => c.hex.toLowerCase() === color.hex.toLowerCase())) return {colors, message: `${color.name}已在自定义配色中。`};
  if (colors.length >= 10) return {colors, message: '最多添加 10 种颜色，请先移除一个颜色。'};
  return {colors: [...colors, color], message: `已添加${color.name}，共 ${colors.length+1} 色。`};
}

if (typeof document !== 'undefined') {
  const catalog = JSON.parse(document.querySelector('#color-data').textContent).map(describeColor);
  const escapeText = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  let selected = Math.floor(Math.random()*catalog.length);
  let variant = 0;
  let colorCount = 5;
  let customColors = [];
  let applicationMode = 'chart';
  let applicationSource = 0;
  let heatmapIndices = [0,1];
  let heatmapCount = 3;
  let heatmapPaletteKey = '';
  // 按实际可用高度重排纵坐标，保持横向尺寸和文字比例不变。
  const heatmapResizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries=>{
    for (const {target:svg,contentRect} of entries) {
      if (!contentRect.width || !contentRect.height) continue;
      const height = 320*contentRect.height/contentRect.width;
      const plotHeight = Math.max(1,height-36);
      const rowHeight = plotHeight/Number(svg.dataset.heatmapRows);
      svg.setAttribute('viewBox',`0 0 320 ${height}`);
      svg.querySelectorAll('[data-heatmap-row]').forEach(cell=>{
        cell.setAttribute('y',36+Number(cell.dataset.heatmapRow)*rowHeight);
        cell.setAttribute('height',rowHeight);
      });
      svg.querySelectorAll('[data-heatmap-row-label]').forEach(label=>{
        label.setAttribute('y',36+(Number(label.dataset.heatmapRowLabel)+0.5)*rowHeight);
      });
      svg.querySelector('rect[fill="url(#heatmap-gradient)"]').setAttribute('height',plotHeight);
      svg.querySelectorAll('g text').forEach((label,i)=>label.setAttribute('y',36+plotHeight*(1-i/2)));
    }
  });
  let generatedPalettes = [];
  const customMenu = document.querySelector('#custom-context-menu');
  const removeCustomButton = document.querySelector('#remove-custom-color');
  let menuColor = null;
  let menuTrigger = null;
  let holdTimer = null;
  let holdStart = null;
  let suppressCustomClickUntil = 0;
  customMenu.hidden = true;
  function closeCustomMenu(restoreFocus = false) {
    customMenu.hidden = true;
    menuColor = null;
    if (restoreFocus && menuTrigger) menuTrigger.focus();
    menuTrigger = null;
  }
  function showCustomMenu(button, x, y) {
    const color = customColors[Number(button.dataset.customIndex)];
    if (!color) return;
    menuColor = color.hex;
    menuTrigger = button;
    removeCustomButton.textContent = `移除「${color.name}」`;
    customMenu.hidden = false;
    const rect = customMenu.getBoundingClientRect();
    customMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    customMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    removeCustomButton.focus({preventScroll:true});
  }
  const clusterCache = new Map();
  const visibleStyles = styles.filter(style => style.algorithm !== 'cluster');
  const catalogPlot = document.querySelector('#catalog-plot');
  let wheelView = {x: 30, y: 30, size: 180};
  function updateWheelZoom() {
    const zoom = 180 / wheelView.size;
    catalogPlot.setAttribute('viewBox', `${wheelView.x} ${wheelView.y} ${wheelView.size} ${wheelView.size}`);
    catalogPlot.style.setProperty('--dot-radius', String(1.5/zoom));
    catalogPlot.style.setProperty('--active-dot-radius', String(2.4/zoom));
    document.querySelector('#wheel-zoom-level').textContent = `${Math.round(zoom*100)}%`;
    document.querySelector('#wheel-zoom-out').disabled = zoom <= 1;
    document.querySelector('#wheel-zoom-in').disabled = zoom >= 8;
  }
  document.querySelector('#wheel-zoom-in').addEventListener('click', () => {
    wheelView = zoomWheelView(wheelView, 1.5);
    updateWheelZoom();
  });
  document.querySelector('#wheel-zoom-out').addEventListener('click', () => {
    wheelView = zoomWheelView(wheelView, 1/1.5);
    updateWheelZoom();
  });
  document.querySelector('#wheel-zoom-reset').addEventListener('click', () => {
    wheelView = {x: 30, y: 30, size: 180};
    updateWheelZoom();
  });
  catalogPlot.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = catalogPlot.getBoundingClientRect();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
    const factor = Math.exp(-Math.max(-200, Math.min(200, delta))*0.003);
    wheelView = zoomWheelView(wheelView, factor, (event.clientX-rect.left)/rect.width, (event.clientY-rect.top)/rect.height);
    updateWheelZoom();
  }, {passive: false});
  updateWheelZoom();
  catalogPlot.innerHTML = `<circle cx="120" cy="120" r="80" fill="none" stroke="#b8bdb5" stroke-width=".4"/><circle cx="120" cy="120" r="40" fill="none" stroke="#cdd1c9" stroke-width=".3" stroke-dasharray="2 3"/><path d="M 40 120 H 200 M 120 40 V 200" fill="none" stroke="#d9ddd5" stroke-width=".3"/>${catalog.map((color,index) => {
    const point = wheelPoint(color);
    const label = escapeText(`${color.name} ${color.hex.toUpperCase()}，选择为主色`);
    return `<circle class="catalog-dot" cx="${point.x}" cy="${point.y}" r="1.5" fill="${color.hex}" data-color="${index}" tabindex="0" role="button" aria-pressed="false" aria-label="${label}"><title>${label}</title></circle>`;
  }).join('')}`;
  const catalogDots = [...catalogPlot.querySelectorAll('[data-color]')];
  const fullWheel = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  fullWheel.style.display = 'none';
  fullWheel.setAttribute('aria-hidden', 'true');
  catalogPlot.prepend(fullWheel);
  const holdButton = document.querySelector('#hold-full-wheel');
  const resetWheel = bindWheelHold(holdButton, visible => {
    if (visible && !fullWheel.childNodes.length) fullWheel.innerHTML = fullWheelMarkup();
    fullWheel.style.display = visible ? '' : 'none';
    catalogPlot.classList.toggle('show-full-wheel', visible);
    holdButton.setAttribute('aria-pressed', String(visible));
    catalogPlot.setAttribute('aria-label', visible ? '完整色盘，固定明度的色相与彩度示意' : '全部颜色的色相与彩度分布');
  });
  function describeDot(event) {
    const dot = event.target.closest('[data-color]');
    if (!dot) return;
    const color = catalog[Number(dot.dataset.color)];
    document.querySelector('#catalog-detail').textContent = `${color.name} · ${color.hex.toUpperCase()} · 点击选择为主色`;
  }
  catalogPlot.addEventListener('pointerover', describeDot);
  catalogPlot.addEventListener('focusin', describeDot);
  document.querySelector('#search').addEventListener('input', event => {
    const query = event.target.value.trim().toLowerCase();
    catalogDots.forEach((dot,index) => {
      const color = catalog[index];
      dot.toggleAttribute('hidden', !`${color.name} ${color.pinyin || ''} ${color.hex}`.toLowerCase().includes(query));
    });
  });
  function switchView(wheel) {
    resetWheel();
    document.querySelector('#catalog-cards').hidden = wheel;
    document.querySelector('#catalog-wheel').hidden = !wheel;
    document.querySelector('#view-cards').setAttribute('aria-pressed', String(!wheel));
    document.querySelector('#view-wheel').setAttribute('aria-pressed', String(wheel));
  }
  document.querySelector('#view-cards').addEventListener('click', () => switchView(false));
  document.querySelector('#view-wheel').addEventListener('click', () => switchView(true));
  function inkFor(background) {
    return catalog.reduce((best, c) => contrast(c, background) > contrast(best, background) ? c : best).hex;
  }
  function updateCatalogSelection() {
    document.querySelectorAll('[data-color]').forEach(button => {
      const index = Number(button.dataset.color);
      const color = catalog[index];
      button.setAttribute('aria-pressed', String(index === selected));
      const label = `选择${color.name}为主色`;
      button.setAttribute('aria-label',label);
      const title = button.querySelector('title');
      if (title) title.textContent = label;
    });
  }
  function hideCustomResults() {
    document.querySelector('#custom-results').hidden = true;
    document.querySelector('#custom-search').setAttribute('aria-expanded','false');
  }
  function renderCustomResults() {
    const query = document.querySelector('#custom-search').value.trim().toLowerCase();
    const results = document.querySelector('#custom-results');
    if (!query) { results.innerHTML = ''; hideCustomResults(); return; }
    results.hidden = false;
    document.querySelector('#custom-search').setAttribute('aria-expanded','true');
    const matches = catalog.map((c,index)=>({c,index})).filter(({c})=>`${c.name} ${c.pinyin || ''} ${c.hex}`.toLowerCase().includes(query));
    results.innerHTML = matches.length ? matches.map(({c,index})=>{
      const picked = customColors.some(color=>color.hex.toLowerCase()===c.hex.toLowerCase());
      return `<button type="button" class="custom-result" data-add-custom="${index}" ${picked ? 'disabled' : ''}><i style="background:${c.hex}" aria-hidden="true"></i><span>${escapeText(c.name)} · ${c.hex.toUpperCase()} · ${picked ? '已添加' : '添加'}</span></button>`;
    }).join('') : '<p>没有找到匹配颜色，请尝试其他名称或色值。</p>';
  }
  function renderCustom(message = '') {
    closeCustomMenu();
    const count = customColors.length;
    document.querySelector('#custom-preview-cta').disabled = count === 0;
    const copy = document.querySelector('#copy-custom');
    copy.disabled = count === 0;
    if (count) copy.dataset.hex = customColors.map(c=>`${c.name}:${c.hex.toUpperCase()}`).join('；');
    else delete copy.dataset.hex;
    document.querySelector('#clear-custom').disabled = count === 0;
    document.querySelector('#custom-status').textContent = message || `已添加 ${count} / 10 色。`;
    const primary = customColors[0] || describeColor({hex:'#29382e'});
    const secondary = customColors[1] || primary;
    const surface = count ? previewSurface(primary,catalog) : {background:{hex:'#f7f5f0'},foreground:{hex:'#292d29'}};
    document.querySelector('#custom-preview').style.background = surface.background.hex;
    document.querySelector('#custom-preview').style.color = surface.foreground.hex;
    document.querySelector('#custom-preview-count').textContent = `共 ${count} 色 · 按添加顺序展示`;
    for (const [id,color] of [['#custom-preview-cta',primary],['#custom-preview-badge',secondary]]) {
      const element = document.querySelector(id);
      element.style.background = color.hex;
      element.style.color = inkFor(color);
    }
    const container = document.querySelector('#custom-content');
    if (!count) container.innerHTML = '<div class="custom-empty">尚未添加颜色。</div>';
    else {
      const roles = customColors.map((_,i)=>`自选色 ${i+1}`);
      container.innerHTML = `<div class="palette-colors" style="grid-template-columns:repeat(${Math.min(count,5)},minmax(0,1fr))">${customColors.map((c,i)=>`<div class="custom-entry"><button type="button" class="palette-color" data-custom-index="${i}" data-hex="${c.hex}" aria-haspopup="menu" title="点击复制，右键或长按移除" aria-label="复制${escapeText(c.name)} ${c.hex}；右键或按 Shift+F10 打开移除菜单"><i style="background:${c.hex}"></i><span class="role">${i+1} · 自选色</span><span>${escapeText(c.name)}</span><span>${c.hex.toUpperCase()}</span></button></div>`).join('')}</div>
      ${renderWheel(customColors,roles,escapeText)}<div class="scheme-note">右键或长按色卡可移除颜色。</div>`;
    }
    renderCustomResults();
    updateCatalogSelection();
    if (applicationSource === 'custom') renderApplication();
  }
  function addToCustom(index) {
    const result = addCustomColor(customColors,catalog[index]);
    customColors = result.colors;
    renderCustom(result.message);
  }
  document.querySelector('#custom-search').addEventListener('input',renderCustomResults);
  document.querySelector('#custom-search').addEventListener('focus',renderCustomResults);
  document.querySelector('#custom-search').addEventListener('keydown',event=>{
    if (event.key === 'Escape') { event.preventDefault(); hideCustomResults(); }
  });
  document.addEventListener('pointerdown',event=>{
    if (event.target !== document.querySelector('#custom-search') && !document.querySelector('#custom-results').contains(event.target)) hideCustomResults();
  });
  document.querySelector('#custom-scheme').addEventListener('focusout',event=>{
    const next = event.relatedTarget;
    if (next !== document.querySelector('#custom-search') && !document.querySelector('#custom-results').contains(next)) hideCustomResults();
  });
  document.querySelector('#custom-results').addEventListener('click',event=>{
    const button = event.target.closest('[data-add-custom]');
    if (!button) return;
    addToCustom(Number(button.dataset.addCustom));
    document.querySelector('#custom-search').value = '';
    hideCustomResults();
    document.querySelector('#custom-search').focus();
  });
  const customContent = document.querySelector('#custom-content');
  customContent.addEventListener('contextmenu',event=>{
    const button = event.target.closest('[data-custom-index]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = button.getBoundingClientRect();
    showCustomMenu(button,event.clientX || rect.left,event.clientY || rect.bottom);
  });
  customContent.addEventListener('keydown',event=>{
    const button = event.target.closest('[data-custom-index]');
    if (!button || !(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return;
    event.preventDefault();
    const rect = button.getBoundingClientRect();
    showCustomMenu(button,rect.left,rect.bottom);
  });
  customMenu.addEventListener('keydown',event=>{
    if (event.key === 'Escape') { event.preventDefault(); closeCustomMenu(true); }
    else if (event.key === 'Tab') closeCustomMenu(true);
    else if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) { event.preventDefault(); removeCustomButton.focus(); }
  });
  document.addEventListener('pointerdown',event=>{ if (!customMenu.hidden && !customMenu.contains(event.target)) closeCustomMenu(); });
  window.addEventListener('scroll',()=>closeCustomMenu(),true);
  window.addEventListener('resize',()=>closeCustomMenu());
  window.addEventListener('blur',()=>closeCustomMenu());
  const cancelCustomHold = () => { clearTimeout(holdTimer); holdTimer = null; holdStart = null; };
  customContent.addEventListener('pointerdown',event=>{
    cancelCustomHold();
    const button = event.target.closest('[data-custom-index]');
    if (!button || event.pointerType !== 'touch') return;
    holdStart = {x:event.clientX,y:event.clientY};
    holdTimer = setTimeout(()=>{
      suppressCustomClickUntil = Date.now()+1000;
      showCustomMenu(button,event.clientX,event.clientY);
      holdTimer = null;
    },550);
  });
  customContent.addEventListener('pointermove',event=>{
    if (holdStart && Math.hypot(event.clientX-holdStart.x,event.clientY-holdStart.y)>8) cancelCustomHold();
  });
  window.addEventListener('pointerup',cancelCustomHold);
  window.addEventListener('pointercancel',cancelCustomHold);
  window.addEventListener('scroll',cancelCustomHold,true);
  window.addEventListener('blur',cancelCustomHold);
  customContent.addEventListener('click',event=>{
    if (Date.now()<suppressCustomClickUntil) { event.preventDefault(); event.stopPropagation(); }
  },true);
  removeCustomButton.addEventListener('click',()=>{
    const color = customColors.find(c=>c.hex === menuColor);
    if (!color) return;
    customColors = customColors.filter(c=>c.hex !== menuColor);
    renderCustom(`已移除${color.name}，剩余 ${customColors.length} 色。`);
    document.querySelector('#custom-search').focus();
  });
  document.querySelector('#clear-custom').addEventListener('click',()=>{ customColors = []; renderCustom('已清空自定义配色。'); document.querySelector('#custom-search').focus(); });
  function renderApplication() {
    const custom = applicationSource === 'custom';
    const palette = custom ? customColors : (generatedPalettes[applicationSource] || []);
    const paletteKey = JSON.stringify([applicationSource,palette.map(c=>c.hex)]);
    if (paletteKey !== heatmapPaletteKey) {
      heatmapIndices = defaultHeatmapIndices(palette,heatmapCount);
      heatmapPaletteKey = paletteKey;
    }
    const name = custom ? '自定义配色' : visibleStyles[applicationSource].name;
    const primary = palette[0] || describeColor({hex:'#29382e'});
    const surface = palette.length ? previewSurface(primary,catalog,custom ? 0 : variant) : {background:{hex:'#f7f5f0'},foreground:{hex:'#292d29'}};
    const usePaletteSurface = !custom && !visibleStyles[applicationSource].algorithm;
    const controls = document.querySelector('#application-controls');
    controls.style.background = (usePaletteSurface && palette[3] || surface.background).hex;
    controls.style.color = (usePaletteSurface && palette[4] || surface.foreground).hex;
    controls.style.setProperty('--application-primary',primary.hex);
    controls.style.setProperty('--application-primary-ink',inkFor(primary));
    document.querySelector('#application-source').textContent = `当前配色：${name} · ${palette.length} 色`;
    document.querySelector('#aigc-panel').hidden = applicationMode !== 'aigc';
    document.querySelector('#application-visual').hidden = applicationMode === 'aigc';
    document.querySelector('#application-aigc-tab').setAttribute('aria-pressed',String(applicationMode === 'aigc'));
    heatmapResizeObserver?.disconnect();
    document.querySelector('#application-visual').innerHTML = applicationMarkup(palette,applicationMode,escapeText,heatmapIndices);
    const heatmap = document.querySelector('#application-visual').querySelector('[data-heatmap-rows]');
    if (heatmap) heatmapResizeObserver?.observe(heatmap);
    document.querySelector('#application-chart-tab').setAttribute('aria-pressed',String(applicationMode === 'chart'));
    document.querySelector('#application-art-tab').setAttribute('aria-pressed',String(applicationMode === 'art'));
    document.querySelector('#custom-preview-cta').setAttribute('aria-pressed',String(custom));
    document.querySelectorAll('[data-preview-scheme]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.previewScheme) === applicationSource)));
  }
  function changeHeatmapColor(event) {
    const target = event.target;
    if ('heatmapCount' in target.dataset) {
      const count = Number(target.value);
      const palette = applicationSource === 'custom' ? customColors : generatedPalettes[applicationSource];
      if (![2,3].includes(count) || palette.length < count) return;
      heatmapCount = count;
      heatmapIndices = defaultHeatmapIndices(palette,count);
    } else if ('heatmapSlot' in target.dataset) {
      const slot = Number(target.dataset.heatmapSlot);
      const index = Number(target.value);
      const palette = applicationSource === 'custom' ? customColors : generatedPalettes[applicationSource];
      if (!Number.isInteger(slot) || slot < 0 || slot >= heatmapIndices.length || !Number.isInteger(index) || index < 0 || index >= palette.length || (heatmapIndices.includes(index) && heatmapIndices[slot] !== index)) return;
      heatmapIndices[slot] = index;
    } else return;
    renderApplication();
    const selector = 'heatmapCount' in target.dataset ? '[data-heatmap-count]' : `[data-heatmap-picker="${target.dataset.heatmapSlot}"] summary`;
    document.querySelector('#application-visual').querySelector(selector)?.focus();
  }
  document.querySelector('#application-visual').addEventListener('change',changeHeatmapColor);
  document.querySelector('#application-visual').addEventListener('click',event=>{
    const button = event.target.closest('[data-heatmap-slot]');
    if (button && !button.disabled) changeHeatmapColor({target:button});
  });
  document.addEventListener('click',event=>{
    document.querySelectorAll('.heatmap-color-picker[open]').forEach(picker=>{
      if (!picker.contains(event.target)) picker.open = false;
    });
  });
  document.querySelector('#application-visual').addEventListener('keydown',event=>{
    if (event.key !== 'Escape') return;
    const picker = event.target.closest('.heatmap-color-picker');
    if (picker) { picker.open = false; picker.querySelector('summary').focus(); }
  });
  function applyPreview(source) {
    applicationSource = source;
    renderApplication();
    document.querySelector('#application-card').scrollIntoView({block:'nearest'});
  }
  document.querySelector('#generated-schemes').addEventListener('click',event=>{
    const button = event.target.closest('[data-preview-scheme]');
    if (button) applyPreview(Number(button.dataset.previewScheme));
  });
  document.querySelector('#custom-preview-cta').addEventListener('click',()=>{ if(customColors.length) applyPreview('custom'); });
  document.querySelector('#application-chart-tab').addEventListener('click',()=>{ applicationMode='chart'; renderApplication(); });
  document.querySelector('#application-art-tab').addEventListener('click',()=>{ applicationMode='art'; renderApplication(); });
  document.querySelector('#application-aigc-tab').addEventListener('click',()=>{ applicationMode='aigc'; renderApplication(); });
  let imageController = null;
  const imageField = id => document.querySelector('#aigc-' + id);
  imageField('clear-key').addEventListener('click',()=>{ imageField('key').value = ''; });
  imageField('cancel').addEventListener('click',()=>{ imageController?.abort(); });
  imageField('form').addEventListener('submit',async event=>{
    event.preventDefault();
    if (imageController) return;
    const key = imageField('key').value.trim();
    const palette = applicationSource === 'custom' ? customColors : (generatedPalettes[applicationSource] || []);
    const status = imageField('status');
    if (!key) { status.textContent = '请先填写接口密钥。'; return; }
    if (!palette.length) { status.textContent = '请先选择至少一种颜色。'; return; }
    const colors = palette.map(c=>`${c.name}（${c.hex.toUpperCase()}）`).join('、');
    const prompt = `创作一幅完整的艺术画作，以以下中国传统配色为主要色彩参考：${colors}。保持色彩协调。\n补充要求：${imageField('prompt').value.trim() || '水墨山水，远山与湖面，留白，无文字'}`;
    const controller = new AbortController();
    imageController = controller;
    let timedOut = false;
    const timer = setTimeout(()=>{ timedOut = true; controller.abort(); },240000);
    imageField('generate').disabled = true;
    imageField('cancel').disabled = false;
    status.textContent = '正在生成，可能需要几分钟；请勿重复提交。';
    try {
      const response = await fetch('https://api.openai.com/v1/images/generations',{
        method:'POST', credentials:'omit', redirect:'error', signal:controller.signal,
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
        body:JSON.stringify({model:imageField('model').value,prompt,n:1,size:imageField('size').value,quality:'medium',output_format:'png'})
      });
      if (!response.ok) {
        const reasons = {400:'请求参数或提示词未被接受。',401:'密钥无效，请重新填写。',403:'账号无权使用该图像模型，请检查模型权限或验证状态。',429:'额度不足或请求过于频繁，请检查账户后再试。'};
        throw new Error(`生成失败（${response.status}）：${reasons[response.status] || '服务暂时不可用，请稍后重试。'}`);
      }
      const result = await response.json();
      const encoded = result.data?.[0]?.b64_json;
      if (typeof encoded !== 'string' || !encoded || !/^[A-Za-z0-9+/=\r\n]+$/.test(encoded)) throw new Error('服务未返回有效的图片数据。');
      const url = 'data:image/png;base64,' + encoded;
      imageField('image').src = url;
      imageField('image').hidden = false;
      imageField('download').href = url;
      imageField('download').hidden = false;
      imageField('caption').textContent = `本幅画作使用的配色：${colors}。切换配色后需重新生成。`;
      status.textContent = '画作已生成，请下载保存；刷新页面会清除本次结果。';
    } catch (error) {
      status.textContent = controller.signal.aborted
        ? (timedOut ? '等待超时。' : '已停止等待。') + '服务端可能仍在生成并计费，请勿立即重复提交。'
        : error instanceof TypeError ? '无法连接图像服务：请检查网络。也可能是浏览器跨域限制，独立 HTML 无法绕过该限制。'
        : error instanceof SyntaxError ? '服务返回的数据无法解析，请稍后重试。' : error.message;
    } finally {
      clearTimeout(timer);
      imageController = null;
      imageField('generate').disabled = false;
      imageField('cancel').disabled = true;
    }
  });
  function render() {
    const base = catalog[selected];
    document.querySelector('#selected-color').textContent = `当前主色：${base.name} · ${base.hex.toUpperCase()}。已生成 ${visibleStyles.length} 套配色，每套 ${colorCount} 色。`;
    updateCatalogSelection();
    generatedPalettes = [];
    document.querySelector('#generated-schemes').innerHTML = visibleStyles.map((style,styleIndex) => {
      const roles = schemeRoles(colorCount, style);
      const cacheKey = `${colorCount}-${variant}`;
      if (style.algorithm === 'cluster' && !clusterCache.has(cacheKey)) clusterCache.set(cacheKey, makeScheme(base, style, catalog, variant, colorCount));
      const palette = style.algorithm === 'cluster' ? clusterCache.get(cacheKey) : makeScheme(base, style, catalog, variant, colorCount);
      generatedPalettes.push(palette);
      const primary = palette[0];
      const secondary = palette[1];
      const accent = palette[colorCount === 2 ? 1 : 2];
      // 未分配背景与文字角色时，按主色匹配预览用色，不改变方案内容。
      const surface = previewSurface(primary,catalog,variant);
      const background = (!style.algorithm && palette[3]) || surface.background;
      const foreground = (!style.algorithm && palette[4]) || surface.foreground;
      const copy = palette.map(c => `${c.name}:${c.hex.toUpperCase()}`).join('；');
      const algorithmNote = style.algorithm === 'cluster' ? '聚类从整个色库提取代表色；换组使用不同初始化。'
        : style.algorithm === 'equal-hue' ? `目标间隔 ${Number((360/colorCount).toFixed(1))}°，实际颜色受色库限制可能偏移；换组调整明度，保持目标方向。${base.C < 0.025 ? '主色接近中性色，以 0° 为参考起点。' : ''}`
        : '贪心最大化最小色差，侧重区分度；固定主色与数量时换组结果不变。';
      return `<article class="scheme"><div class="scheme-title"><h3>${style.name}</h3><button class="copy-palette" type="button" data-hex="${escapeText(copy)}" aria-label="复制${style.name}整组配色">复制整组</button></div>
        <div class="preview" style="background:${background.hex};color:${foreground.hex}">
        <span class="preview-badge" style="background:${secondary.hex};color:${inkFor(secondary)}">山川与四时</span>
        <h4>把日常，染成喜欢的颜色。</h4><p>${style.hint}</p>
        <button type="button" class="preview-cta" data-preview-scheme="${styleIndex}" aria-pressed="${applicationSource === styleIndex}" aria-controls="application-card" style="background:${primary.hex};color:${inkFor(primary)}">探索色彩 <span aria-hidden="true">→</span></button>
        <span aria-hidden="true" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${accent.hex};margin-left:12px"></span></div>
        <div class="palette-colors" style="grid-template-columns:repeat(${Math.min(colorCount,5)},minmax(0,1fr))">${palette.map((c,i) => `<button type="button" class="palette-color" data-hex="${c.hex}" aria-label="复制${roles[i]}${escapeText(c.name)} ${c.hex}"><i style="background:${c.hex}"></i><span class="role">${i+1} · ${roles[i]}</span><span>${escapeText(c.name)}</span><span>${c.hex.toUpperCase()}</span></button>`).join('')}</div>
        ${renderWheel(palette, roles, escapeText)}
        <div class="scheme-note">${style.algorithm ? algorithmNote : ''}${style.balanced ? (colorCount < 3 ? '两色仅展示其中一个搭配方向；至少选择三色可展示完整关系。' : '按目标色相寻找色库近似色，实际角度可能偏移。') : ''}</div></article>`;
    }).join('');
    renderApplication();
  }
  function selectColor(event) {
    const button = event.target.closest('[data-color]');
    if (!button) return;
    selected = Number(button.dataset.color);
    variant = 0;
    render();
    document.querySelector('.palette-panel').scrollIntoView({behavior: 'instant', block: 'start'});
  }
  document.querySelector('.grid').addEventListener('click', selectColor);
  catalogPlot.addEventListener('click', selectColor);
  catalogPlot.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-color]')) {
      event.preventDefault();
      selectColor(event);
    }
  });
  document.querySelector('#random-color').addEventListener('click', () => {
    selected = (selected + 1 + Math.floor(Math.random() * (catalog.length-1))) % catalog.length;
    variant = 0;
    render();
  });
  document.querySelector('#regenerate').addEventListener('click', () => { variant = (variant+1)%4; render(); });
  document.querySelector('#color-count').addEventListener('change', event => {
    colorCount = Number(event.target.value);
    render();
  });
  render();
  renderCustom();
}
