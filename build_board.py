"""从颜色数据生成可离线打开的色彩展示板。"""

import html
import json
import re
from pathlib import Path


def main():
    root = Path(__file__).resolve().parent
    colors = json.loads((root / 'colors.json').read_text(encoding='utf-8'))
    cards = []
    for index, color in enumerate(colors, 1):
        value = color['hex']
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', value):
            raise ValueError(f'第 {index} 个颜色的 HEX 色值无效：{value}')
        name = html.escape(color['name'])
        channels = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in channels]
        luminance = sum(v * weight for v, weight in zip(linear, (0.2126, 0.7152, 0.0722)))
        # 选择对比度更高的黑白文字，保证文字直接叠在底色上仍清晰。
        ink = '#000000' if (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) else '#ffffff'
        search = html.escape(f"{color['name']} {color.get('pinyin', '')} {value}".lower(), quote=True)
        cards.append(f'''<article class="card" data-search="{search}" style="background-color:{value};color:{ink}">
          <button type="button" class="swatch" style="background-color:{value}" data-color="{index - 1}" aria-pressed="false" aria-label="选择{name}为主色"></button>
          <div class="details"><h2>{name}</h2>
          <button class="hex" type="button" data-hex="{value}" aria-label="复制{name}的色值 {value}">{value.upper()} <span aria-hidden="true">⧉</span></button></div>
        </article>''')

    page = '''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="浏览中国传统色彩，查找中文色名与 HEX 色值。">
<title>中国传统色 · 色彩展示板</title>
<style>
.aigc-options{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.aigc-options label{min-width:0}
:root{color-scheme:light;--paper:#f7f5f0;--ink:#292d29;--muted:#73776f;--line:#dedfd5}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Microsoft YaHei","PingFang SC",sans-serif}
main{max-width:1480px;margin:auto;padding:36px 48px 60px}.masthead{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:22px;font-size:13px;letter-spacing:2px}.brand{display:flex;align-items:center;gap:12px}.seal{background:#994538;color:#fff;padding:8px 9px;font-family:serif;letter-spacing:0}.edition{color:var(--muted);letter-spacing:1px}
header{padding:42px 0 34px;display:flex;align-items:end;justify-content:space-between;gap:24px}h1{font-family:"Songti SC","SimSun",serif;font-size:clamp(32px,5vw,52px);font-weight:500;letter-spacing:6px;margin:0 0 18px}header p{margin:0;color:var(--muted);font-size:14px;line-height:1.9}.total{text-align:right;white-space:nowrap;color:var(--muted);font-size:12px}.total strong{display:block;color:var(--ink);font:44px Georgia,serif;margin-bottom:6px}
.toolbar{border-top:1px solid var(--line);padding:20px 0 24px;display:flex;gap:18px;align-items:center;justify-content:space-between}.searchbox{display:flex;align-items:center;gap:12px;width:min(430px,100%);border:1px solid #cccfc4;background:#fff;padding:0 14px;border-radius:4px}.searchbox:focus-within{outline:2px solid #526954;outline-offset:2px}.searchbox label{font-size:13px;white-space:nowrap;color:var(--muted)}input{border:0;outline:0;background:transparent;width:100%;padding:13px 0;font:14px inherit;font-family:inherit;min-width:0}.count{font-size:12px;color:var(--muted);white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:24px 18px}.card{background:#fff;border:1px solid #e5e5dd;border-radius:5px;overflow:hidden}.swatch{height:156px;border-bottom:1px solid #00000006}.details{padding:17px 16px 15px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px 6px}h2{font-size:16px;font-weight:500;letter-spacing:1px;margin:0}.number{font:11px ui-monospace,monospace;color:#85897f}.hex{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;background:none;border:0;padding:0;color:#62685f;font:12px ui-monospace,monospace;text-align:left;cursor:pointer;min-height:24px;letter-spacing:1px}.hex span{font-size:18px}.hex:hover{color:#222}.hex:focus-visible{outline:2px solid #526954;outline-offset:4px}.card[hidden]{display:none}.empty{text-align:center;padding:65px 12px;color:var(--muted)}footer{border-top:1px solid var(--line);margin-top:36px;padding-top:22px;font-size:12px;color:var(--muted);line-height:1.8}.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#29382e;color:#fff;padding:13px 24px;border-radius:5px;box-shadow:0 4px 24px #0002;font-size:14px;max-width:90vw;text-align:center}.toast:empty{display:none}
@media(min-width:1350px){.swatch{height:174px}}@media(max-width:1100px){.grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:720px){main{padding:24px}.grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 12px}.swatch{height:135px}.details{padding:12px}.number{display:none}h2{font-size:14px;grid-column:1/-1}header{padding:32px 0}.total strong{font-size:32px}}@media(max-width:480px){main{padding:20px 16px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar{align-items:stretch;flex-direction:column;gap:12px}.edition{font-size:11px;letter-spacing:0}header{align-items:start}.total{padding-top:4px}h1{letter-spacing:3px;font-size:30px}.swatch{height:148px}}
.swatch{display:block;width:100%;border:0;cursor:pointer}.swatch:focus-visible{outline:3px solid #fff;outline-offset:-6px}.card:has([aria-pressed="true"]){outline:2px solid #526954;outline-offset:3px}.palette-panel{border-top:1px solid var(--line);padding:24px 0 30px}.palette-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.palette-heading h2{font-size:22px}.palette-heading p,.palette-note{color:var(--muted);font-size:13px;line-height:1.8}.palette-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.palette-actions button,.copy-palette{background:white;border:1px solid var(--line);padding:9px 12px;border-radius:4px;color:var(--ink);cursor:pointer;font:inherit;font-size:13px}.schemes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:20px}.scheme{border:1px solid var(--line);border-radius:6px;overflow:hidden;background:white}.scheme-title{padding:16px;display:flex;align-items:center;justify-content:space-between;gap:8px}.scheme-title h3{margin:0;font-size:16px}.preview{padding:24px;min-height:200px}.preview h4{font-family:serif;font-size:25px;margin:12px 0}.preview p{font-size:13px;line-height:1.8}.preview-badge{display:inline-block;padding:5px 10px;border-radius:3px;font-size:12px}.preview-cta{display:inline-block;padding:8px 14px;border-radius:4px;font-size:13px}.palette-colors{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));padding:12px 8px;gap:4px}.palette-color{border:0;background:none;padding:0;color:var(--ink);cursor:pointer;min-width:0}.palette-color i{display:block;height:42px;border:1px solid #0001;border-radius:3px}.palette-color span{display:block;font-size:11px;margin-top:7px;overflow-wrap:anywhere}.palette-color .role{color:var(--muted)}.scheme-note{font-size:12px;color:var(--muted);padding:0 16px 16px;line-height:1.7}.palette-actions button:focus-visible,.palette-color:focus-visible,.copy-palette:focus-visible{outline:2px solid #526954;outline-offset:3px}@media(max-width:1050px){.schemes{grid-template-columns:1fr}.palette-colors{gap:12px;padding:16px}.palette-color i{height:55px}}
.palette-actions label{font-size:13px;color:var(--muted)}.palette-actions select{padding:9px 12px;border:1px solid var(--line);border-radius:4px;background:white;color:var(--ink);font:inherit;font-size:13px}.palette-actions select:focus-visible{outline:2px solid #526954;outline-offset:3px}
/* 下方色库使用紧凑色块，名称与复制按钮直接叠在颜色上。 */
.grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px}
.grid .card{position:relative;min-height:108px;border:0;box-shadow:inset 0 0 0 1px #0000000d}
.grid .swatch{position:absolute;inset:0;height:100%;width:100%;color:inherit;border-radius:inherit}
.grid .swatch:focus-visible{outline:2px solid currentColor;outline-offset:-5px}
.grid .details{position:relative;pointer-events:none;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-end;gap:7px;padding:14px;min-height:108px}
.grid h2{font-size:14px;line-height:1.5;letter-spacing:1px}
.grid .hex{pointer-events:auto;color:inherit;min-height:28px;font-size:11px;letter-spacing:.5px}
.grid .hex:hover{text-decoration:underline;text-underline-offset:3px}
.grid .hex:focus-visible{outline:2px solid currentColor;outline-offset:2px}
@media(max-width:480px){.grid{grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:10px}.grid .details{padding:12px}}
.color-wheel{margin:0;padding:16px 16px 4px;border-top:1px solid var(--line)}
.color-wheel figcaption{font-size:13px}.color-wheel figcaption span{font-size:11px;color:var(--muted);margin-left:8px}
.wheel-plot{position:relative;max-width:280px;margin:10px auto;aspect-ratio:1}
.wheel-plot svg{display:block;width:100%;height:100%}
.wheel-marker{position:absolute;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 1px #777;padding:0;font:12px ui-monospace,monospace;cursor:pointer}
.wheel-marker:hover,.wheel-marker:focus-visible{outline:2px solid #29382e;outline-offset:3px;z-index:1}
.color-wheel p{font-size:11px;line-height:1.7;color:var(--muted);margin:4px 0 8px}
.board-views{display:flex;gap:8px;margin-bottom:18px}.board-views button{padding:8px 16px;border:1px solid var(--line);background:white;border-radius:4px;color:var(--ink);cursor:pointer}.board-views button[aria-pressed="true"]{background:#29382e;color:white}
.all-wheel{border:1px solid var(--line);border-radius:6px;padding:20px;background:transparent}.all-wheel[hidden],.grid[hidden]{display:none}.all-wheel svg{display:block;width:100%;max-width:680px;margin:auto;overflow:visible}.all-wheel p{font-size:13px;color:var(--muted);line-height:1.8}.catalog-dot{cursor:pointer;stroke:#555;stroke-width:.15}.catalog-dot:hover,.catalog-dot:focus-visible,.catalog-dot[aria-pressed="true"]{stroke:#111;stroke-width:.7;outline:none;r:2.4}.catalog-dot[hidden]{display:none}.board-views button:focus-visible{outline:2px solid #526954;outline-offset:3px}
.wheel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
#hold-full-wheel{padding:9px 14px;background:white;color:var(--ink);border:1px solid var(--line);border-radius:4px;font:inherit;font-size:13px;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#hold-full-wheel[aria-pressed="true"]{background:#29382e;color:white}#hold-full-wheel:focus-visible{outline:2px solid #526954;outline-offset:3px}.show-full-wheel .catalog-dot{visibility:hidden;pointer-events:none}
.wheel-zoom-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:14px 0}.wheel-zoom-controls button{padding:8px 12px;border:1px solid var(--line);border-radius:4px;background:white;color:var(--ink);cursor:pointer;font:inherit;font-size:13px}.wheel-zoom-controls button:disabled{opacity:.4;cursor:default}.wheel-zoom-controls button:focus-visible{outline:2px solid #526954;outline-offset:3px}.wheel-zoom-controls output{min-width:50px;text-align:center;font:13px ui-monospace,monospace}.wheel-zoom-controls span{font-size:12px;color:var(--muted)}
#catalog-plot{overflow:hidden;aspect-ratio:1}.catalog-dot{r:var(--dot-radius,1.5);vector-effect:non-scaling-stroke;stroke-width:.5}.catalog-dot:hover,.catalog-dot:focus-visible,.catalog-dot[aria-pressed="true"]{r:var(--active-dot-radius,2.4);stroke-width:1.5}
.custom-tools{padding:0 16px 16px}.custom-tools label{display:block;font-size:13px;margin:12px 0 6px}.custom-tools input{border:1px solid var(--line);border-radius:4px;padding:10px;font-size:13px}.custom-tools input:focus-visible{outline:2px solid #526954;outline-offset:2px}.custom-actions{display:flex;gap:8px;flex-wrap:wrap}.custom-actions button,.custom-result,.remove-color{border:1px solid var(--line);background:white;border-radius:4px;padding:7px 10px;font:inherit;font-size:12px;color:var(--ink);cursor:pointer}.custom-actions button[aria-pressed="true"]{background:#29382e;color:white}.custom-actions button:disabled,.custom-result:disabled{opacity:.5;cursor:default}.custom-results{display:grid;gap:5px;max-height:190px;overflow:auto;margin-top:8px}.custom-result{display:flex;align-items:center;gap:8px;text-align:left}.custom-result i{width:20px;height:20px;border:1px solid #0002;border-radius:3px;flex-shrink:0}.custom-help,.custom-results p{font-size:12px;color:var(--muted);line-height:1.8}.custom-entry .palette-color{width:100%}.remove-color{width:100%;padding:5px 0;margin-top:8px}.custom-result:focus-visible,.remove-color:focus-visible,.custom-actions button:focus-visible{outline:2px solid #526954;outline-offset:2px}.custom-empty{padding:24px 16px;color:var(--muted);font-size:13px;line-height:1.8}.catalog-mode{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}.catalog-mode p{margin:0;font-size:13px;color:var(--muted)}#generated-schemes{display:contents}
.custom-search-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.custom-search-row .preview-cta{white-space:nowrap}.custom-search-row input{flex:1 1 130px;width:0;min-width:100px;background:white;color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:9px;font-size:12px}.custom-search-row button{padding:8px 10px;border:1px solid var(--line);border-radius:4px;background:white;color:var(--ink);cursor:pointer;white-space:nowrap}.custom-search-row button:disabled{opacity:.5;cursor:default}.custom-search-row input:focus-visible,.custom-search-row button:focus-visible{outline:2px solid #526954;outline-offset:2px}#custom-status{margin-bottom:0}
.custom-context-menu{position:fixed;z-index:1000;min-width:160px;padding:5px;background:white;border:1px solid var(--line);border-radius:6px;box-shadow:0 6px 24px #0002}.custom-context-menu[hidden]{display:none}.custom-context-menu button{display:block;width:100%;border:0;background:transparent;border-radius:3px;padding:10px 14px;text-align:left;color:#994538;font:inherit;font-size:13px;cursor:pointer}.custom-context-menu button:hover,.custom-context-menu button:focus-visible{background:#f5eee9;outline:2px solid #994538;outline-offset:-2px}.custom-entry .palette-color{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}
#custom-status{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
/* 同一行方案共享各区块高度，搜索结果浮动显示，不挤动色卡。 */
@supports(grid-template-rows:subgrid){.schemes>.scheme,.schemes>#generated-schemes>.scheme{display:grid;grid-template-rows:subgrid;grid-row:span 5;row-gap:0}#custom-content{display:contents}.custom-empty{grid-row:3 / span 3}.scheme .palette-colors{align-content:start}}
.preview-cta{height:34px;box-sizing:border-box;vertical-align:middle}
.custom-search-row{position:relative;flex-wrap:nowrap;height:34px;gap:8px}.custom-search-row input{flex:1 1 0;min-width:0;height:34px;box-sizing:border-box}.custom-search-row>button{height:34px;padding:0 10px;box-sizing:border-box}
#custom-scheme{overflow:visible;position:relative}.custom-results{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:30;margin:0;padding:8px;max-height:220px;background:white;border:1px solid var(--line);border-radius:5px;box-shadow:0 6px 20px #0002}.custom-results:empty,.custom-results[hidden]{display:none}.custom-results p{margin:0}
.scheme-note:empty{padding:0}
button.preview-cta{border:0;cursor:pointer;font-family:inherit;line-height:18px}button.preview-cta:disabled{opacity:.45;cursor:default}button.preview-cta:focus-visible{outline:2px solid #526954;outline-offset:3px}button.preview-cta[aria-pressed="true"]{box-shadow:0 0 0 2px white,0 0 0 3px #526954}
.application-content{grid-row:3 / span 3;padding:16px;align-self:start}.application-tabs{display:flex;gap:8px;margin-bottom:14px}.application-tabs button{flex:1;border:1px solid var(--line);border-radius:4px;background:white;padding:9px;color:var(--ink);font:inherit;font-size:13px;cursor:pointer}.application-tabs button[aria-pressed="true"]{background:#29382e;color:white}.application-tabs button:focus-visible{outline:2px solid #526954;outline-offset:3px}.application-source{font-size:12px;color:var(--muted);line-height:1.7;margin:0 0 16px}.application-hint{color:var(--muted);font-size:12px;line-height:1.8;margin:0 0 14px}.application-visual h4{font-size:14px;font-weight:500;margin:0 0 10px}.application-visual svg{display:block;width:100%;height:auto}.application-chart{padding:14px 0;border-top:1px solid var(--line)}.application-donut{max-width:170px;margin:0 auto}.application-legend{display:flex;flex-wrap:wrap;gap:8px 12px;margin-top:14px;font-size:11px;color:var(--muted)}.application-legend span{display:inline-flex;gap:5px;align-items:center}.application-legend i{display:inline-block;width:12px;height:12px;border:1px solid #0002;border-radius:2px}.application-art{margin:0}.application-art svg{border-radius:4px}.application-art figcaption{margin:12px 0;font-family:serif;font-size:18px}.application-empty{color:var(--muted);padding:30px 0;font-size:13px;line-height:1.8}
.heatmap-controls{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:6px;margin-bottom:12px}.heatmap-controls label{font-size:12px;color:var(--muted);min-width:0}.heatmap-controls select{display:block;width:100%;margin-top:6px;padding:7px 4px;border:1px solid var(--line);border-radius:4px;background:white;color:var(--ink);font:inherit}.heatmap-controls select:focus-visible{outline:2px solid #526954;outline-offset:2px}
.heatmap-color-field{font-size:12px;color:var(--muted);min-width:0}.heatmap-color-picker{position:relative;margin-top:6px}.heatmap-color-picker summary{display:flex;align-items:center;gap:5px;list-style:none;border:1px solid var(--line);border-radius:4px;padding:7px 5px;background:white;color:var(--ink);cursor:pointer}.heatmap-color-picker summary::-webkit-details-marker{display:none}.heatmap-color-picker summary::after{content:'▾';margin-left:auto}.heatmap-color-picker summary span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.heatmap-color-picker i{display:inline-block;width:12px;height:12px;flex-shrink:0;border:1px solid #0003;border-radius:2px}.heatmap-color-picker[open]{z-index:40}.heatmap-color-options{position:absolute;top:calc(100% + 4px);right:0;min-width:125px;max-height:240px;overflow:auto;padding:4px;background:white;border:1px solid var(--line);border-radius:4px;box-shadow:0 4px 16px #0002}.heatmap-color-options button{display:flex;align-items:center;gap:8px;width:100%;border:0;border-radius:3px;padding:8px;background:white;color:var(--ink);font:inherit;text-align:left;cursor:pointer}.heatmap-color-options button:hover,.heatmap-color-options button[aria-pressed="true"]{background:#eef1eb}.heatmap-color-options button:disabled{opacity:.4;cursor:default}.heatmap-color-picker summary:focus-visible,.heatmap-color-options button:focus-visible{outline:2px solid #526954;outline-offset:-2px}#application-card{overflow:visible}
.application-donut-layout{display:grid;grid-template-columns:minmax(0,140px) 110px;justify-content:center;align-items:center;gap:12px;padding-left:12px}.application-donut-layout .application-donut{min-width:0;margin:0}.application-donut-layout .application-legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 8px;margin:0}.application-donut-layout .application-legend span{white-space:nowrap;grid-column:1}.application-donut-layout .application-legend.is-two-columns{grid-template-rows:repeat(5,auto);grid-auto-flow:column}.application-donut-layout .application-legend.is-two-columns span{grid-column:auto}
.application-art{padding-top:14px}
.application-visual>.application-chart:first-child{border-top:0;padding-bottom:0}
.application-visual>.application-chart:last-child{padding-bottom:0}
.application-controls{grid-row:2;padding:24px;min-height:200px;display:flex;flex-direction:column;justify-content:center}.application-controls .application-source,.application-controls .application-hint{color:inherit}.application-controls .application-hint{margin-bottom:0}.application-controls .application-tabs button[aria-pressed="true"]{background:var(--application-primary,#29382e);color:var(--application-primary-ink,white)}
/* 多列时由配色卡决定行高，作品仅使用分配到的空间，喵~ */
@media(min-width:1051px){
  #application-card .application-controls{contain:size;min-height:0}
  #application-card .application-content{contain:size;min-height:0;align-self:stretch;display:flex;flex-direction:column;overflow:auto}
  #application-card .application-content> :not(.application-visual){flex-shrink:0}
  #application-card .application-visual:not([hidden]){flex:1;min-height:0;display:flex;flex-direction:column}
  #application-card .application-chart,#application-card .application-legend{flex-shrink:0}
  #application-card .application-chart:last-child{flex:1;display:flex;flex-direction:column;min-height:240px}
  #application-card .application-chart:last-child> :not(svg){flex-shrink:0}
  #application-card .application-chart:last-child>svg{flex:1;min-height:100px;height:0;width:100%}
  #application-card .application-donut{width:100%;max-width:140px}
  #application-card .application-art{flex:1;min-height:180px;display:flex;flex-direction:column}
  #application-card .application-art svg{flex:1;min-height:120px;height:0;object-fit:contain}
  #application-card .application-art figcaption{flex-shrink:0}
}
.aigc-panel[hidden]{display:none}.aigc-panel label{display:block;margin:12px 0;font-size:13px}.aigc-panel input,.aigc-panel textarea,.aigc-panel select{display:block;width:100%;margin-top:6px;border:1px solid var(--line);border-radius:4px;padding:10px;font:inherit;background:white;color:var(--ink)}.aigc-panel textarea{min-height:100px;resize:vertical}.aigc-panel :focus-visible{outline:2px solid #526954;outline-offset:2px}.aigc-panel button,.aigc-panel a{display:inline-block;margin:4px 6px 4px 0;padding:9px 12px;border:1px solid var(--line);border-radius:4px;background:white;color:var(--ink);font:inherit;font-size:13px;cursor:pointer}.aigc-panel button:disabled{opacity:.5;cursor:default}.aigc-panel img{width:100%;height:auto;border-radius:4px}.aigc-panel p{font-size:12px;line-height:1.8;overflow-wrap:anywhere}.aigc-panel a[hidden],.aigc-panel img[hidden]{display:none}</style>
</head>
<body>
<main>
<div class="masthead"><div class="brand"><span class="seal">色</span><span>中国传统色谱</span></div><span class="edition">一色一名，自有意趣</span></div>
<header><div><h1>万物有色</h1><p>在细微的色差里，发现东方色彩之美</p></div><div class="total"><strong>__TOTAL__</strong>种传统色彩</div></header>
<section class="palette-panel" aria-labelledby="palette-title">
<div class="palette-heading"><div><h2 id="palette-title">从一抹颜色，找到一个世界</h2><p id="selected-color" role="status"></p></div><div class="palette-actions"><label for="color-count">每组颜色数量</label><select id="color-count"><option value="2">2 色</option><option value="3">3 色</option><option value="4">4 色</option><option value="5" selected>5 色</option><option value="6">6 色</option><option value="7">7 色</option><option value="8">8 色</option><option value="9">9 色</option><option value="10">10 色</option></select><button id="random-color" type="button">随机选主色</button><button id="regenerate" type="button">换一组搭配</button></div></div>
<div class="schemes" id="schemes">
<div id="generated-schemes"></div>
<article class="scheme" id="custom-scheme" aria-labelledby="custom-title"><div class="scheme-title"><h3 id="custom-title">自定义配色</h3><button type="button" class="copy-palette" id="copy-custom" disabled>复制整组</button></div>
<div class="preview" id="custom-preview" style="background:#f7f5f0;color:#292d29"><span class="preview-badge" id="custom-preview-badge">我的星河</span><h4>把喜欢的颜色，组成一段奇缘。</h4><p id="custom-preview-count">共 0 色 · 按添加顺序展示</p><div class="custom-search-row"><button type="button" class="preview-cta" id="custom-preview-cta" aria-pressed="false" aria-controls="application-card" disabled>探索色彩 →</button><input id="custom-search" type="search" placeholder="搜索名称、拼音或 HEX" aria-label="搜索并添加颜色" autocomplete="off" aria-controls="custom-results" aria-expanded="false"><button type="button" id="clear-custom" disabled>清空</button><div class="custom-results" id="custom-results" hidden></div></div><p class="custom-help" id="custom-status" role="status">尚未添加颜色。</p></div><div id="custom-content"></div></article>
<article class="scheme" id="application-card" aria-labelledby="application-title"><div class="scheme-title"><h3 id="application-title">应用预览</h3></div><div class="application-controls" id="application-controls"><div class="application-tabs" role="group" aria-label="应用预览类型"><button type="button" id="application-chart-tab" aria-pressed="true" aria-controls="application-visual">数据图表</button><button type="button" id="application-art-tab" aria-pressed="false" aria-controls="application-visual">SVG插画</button><button type="button" id="application-aigc-tab" aria-pressed="false" aria-controls="aigc-panel">AIGC</button></div><p class="application-source" id="application-source" role="status"></p><p class="application-hint">点击任一配色卡的“探索色彩”，看看它在作品中的样子。</p></div><div class="application-content"><div class="application-visual" id="application-visual"></div><section class="aigc-panel" id="aigc-panel" aria-label="AIGC 画作生成" hidden>
<p>使用当前配色与补充提示词生成画作。需自备 OpenAI 密钥和网络环境。</p>
<form id="aigc-form">
<label>接口密钥<input id="aigc-key" type="password" autocomplete="off" spellcheck="false" placeholder="填写 OpenAI 密钥，仅直连、不保存" title="密钥仅用于直接请求 OpenAI，不写入文件或浏览器存储。请仅在可信设备上使用。" required></label>
<label>补充提示词<textarea id="aigc-prompt" maxlength="8000" placeholder="例如：水墨山水，远山与湖面，留白，无文字"></textarea></label>
<div class="aigc-options">
<label>图像模型<select id="aigc-model"><option value="gpt-image-1">GPT Image 1</option><option value="gpt-image-1.5">GPT Image 1.5</option></select></label>
<label>画幅<select id="aigc-size"><option value="1024x1024">方形</option><option value="1536x1024">横幅</option><option value="1024x1536">竖幅</option></select></label>
</div>
<button id="aigc-generate" type="submit">生成画作</button><button id="aigc-cancel" type="button" disabled>停止等待</button><button id="aigc-clear-key" type="button">清除密钥</button>
</form><p id="aigc-status" role="status" aria-live="polite">等待生成。</p><img id="aigc-image" alt="生成的配色画作" hidden><p id="aigc-caption"></p><a id="aigc-download" download="配色画作.png" hidden>下载画作</a>
</section></div></article>
</div>
</section>
<div class="toolbar"><div class="searchbox"><label for="search">查找颜色</label><input id="search" type="search" placeholder="输入中文名、拼音或 HEX" autocomplete="off"></div><span class="count" id="count" role="status">共 __TOTAL__ 种颜色</span></div>
<div class="board-views" role="group" aria-label="全部颜色展示方式"><button type="button" id="view-cards" aria-pressed="true" aria-controls="catalog-cards">色块视图</button><button type="button" id="view-wheel" aria-pressed="false" aria-controls="catalog-wheel">色盘视图</button></div>
<section class="grid" id="catalog-cards" aria-label="颜色展示板">__CARDS__</section>
<section class="all-wheel" id="catalog-wheel" aria-label="全部颜色色盘" hidden><div class="wheel-heading"><h2>全部颜色的色盘位置</h2><button type="button" id="hold-full-wheel" aria-pressed="false" aria-controls="catalog-plot" aria-describedby="wheel-hold-help">显示完整色盘</button></div><p id="wheel-hold-help">按住按钮查看完整色盘，松开恢复色库；也可聚焦按钮后按住空格或回车。完整色盘采用固定明度示意，部分颜色超出屏幕色域，实际颜色以色卡为准。</p><p>角度表示色相，越靠外彩度越高；只显示色库中的颜色，其他区域透明。靠近的颜色可能重叠，可搜索名称或色值缩小范围。</p><div class="wheel-zoom-controls" role="group" aria-label="色盘缩放"><button type="button" id="wheel-zoom-out" aria-label="缩小色盘">缩小 −</button><output id="wheel-zoom-level" aria-live="polite" aria-label="缩放比例">100%</output><button type="button" id="wheel-zoom-in" aria-label="放大色盘">放大 ＋</button><button type="button" id="wheel-zoom-reset">重置</button><span>滚轮围绕指针缩放 · 支持 100%～800%</span></div><svg id="catalog-plot" viewBox="30 30 180 180" aria-label="全部颜色的色相与彩度分布"></svg><p id="catalog-detail" role="status">悬停或聚焦圆点查看颜色名称和色值，点击圆点选择主色。</p></section>
<p class="empty" id="empty" hidden>没有找到匹配的颜色，试试其他名称或色值。</p>
<footer>色彩来源：https://chinese-colors.heyfe.org/</footer>
</main>
<div class="toast" role="status" aria-live="polite" id="toast"></div>
<div class="custom-context-menu" id="custom-context-menu" role="menu" aria-label="自定义颜色操作" hidden><button type="button" id="remove-custom-color" role="menuitem">移除此颜色</button></div>
<script>
const cards = [...document.querySelectorAll('.card')];
document.querySelector('#search').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  let visible = 0;
  for (const card of cards) {
    card.hidden = !card.dataset.search.includes(query);
    if (!card.hidden) visible++;
  }
  document.querySelector('#count').textContent = `显示 ${visible} / ${cards.length} 种颜色`;
  document.querySelector('#empty').hidden = visible !== 0;
});
let toastTimer;
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-hex]');
  if (!button) return;
  const value = button.dataset.hex.toUpperCase();
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      copied = true;
    }
  } catch { /* 浏览器限制剪贴板时尝试本地复制方式。 */ }
  if (!copied) {
    const field = document.createElement('textarea');
    field.value = value;
    field.style.cssText = 'position:fixed;opacity:0;left:0;top:0';
    field.setAttribute('aria-label', '待复制色值');
    document.body.append(field);
    field.select();
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    field.remove();
    button.focus();
  }
  const toast = document.querySelector('#toast');
  toast.textContent = copied ? `已复制 ${value}` : `无法自动复制，请手动复制：${value}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 3500);
});
</script>
<script id="color-data" type="application/json">__DATA__</script>
<script>__PALETTE_SCRIPT__</script>
</body>
</html>
'''
    page = page.replace('__TOTAL__', str(len(colors))).replace('__CARDS__', '\n'.join(cards))
    page = page.replace('__DATA__', json.dumps(colors, ensure_ascii=False).replace('<', '\\u003c'))
    page = page.replace('__PALETTE_SCRIPT__', (root / 'palette.js').read_text(encoding='utf-8'))
    (root / 'index.html').write_text(page, encoding='utf-8')
    print(f'已生成 index.html，共展示 {len(colors)} 种颜色。')


if __name__ == '__main__':
    main()
