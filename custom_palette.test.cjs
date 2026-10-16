/* 使用轻量页面替身验证交互状态，浏览器布局仍需另行检查。 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname,'palette.js'),'utf8');
const html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const colors = JSON.parse(fs.readFileSync(path.join(__dirname,'colors.json'),'utf8'));
class Element {
  constructor() {
    this.dataset = {}; this.attributes = {}; this.events = {}; this.value = ''; this.childNodes = [];
    this.style = {setProperty(){}}; this.classList = {toggle(){}}; this.hidden = false;
    this.innerWidth = 1000; this.innerHeight = 800;
  }
  addEventListener(name,handler) { (this.events[name] ||= []).push(handler); }
  fire(name,target=this,fields={}) {
    const event = {target,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...fields};
    for(const fn of this.events[name]||[]) fn(event);
    return event;
  }
  getBoundingClientRect() { return {left:100,top:100,bottom:130,width:160,height:45}; }
  contains(target) { return target === this; }
  setAttribute(key,value) { this.attributes[key] = value; }
  toggleAttribute(key,value) { if(value) this.attributes[key]=''; else delete this.attributes[key]; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest(selector) { return this.matches(selector) ? this : null; }
  matches(selector) {
    const key = {'[data-color]':'color','[data-add-custom]':'addCustom','[data-custom-index]':'customIndex','[data-preview-scheme]':'previewScheme'}[selector];
    return key !== undefined && key in this.dataset;
  }
  focus() {} scrollIntoView() {} prepend(node) { this.childNodes.unshift(node); }
}
const ids = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>['#'+m[1],new Element()]));
const get = selector => { assert.ok(ids.has(selector),`页面必须存在控件：${selector}`); return ids.get(selector); };
const dots = colors.map((_,i)=>{ const node = new Element(); node.dataset.color=String(i); return node; });
get('#color-data').textContent = JSON.stringify(colors);
get('#catalog-plot').querySelectorAll = () => dots;
const page = new Element();
page.querySelector = selector => get(selector === '.grid' ? '#catalog-cards' : selector === '.palette-panel' ? '#schemes' : selector);
const previewButtons = Array.from({length:7},(_,i)=>{const button=new Element();button.dataset.previewScheme=String(i);return button;});
page.querySelectorAll = selector => selector === '[data-color]' ? dots : selector === '[data-preview-scheme]' ? previewButtons : [];
page.createElementNS = () => new Element();
const host = new Element();
const timers = new Map();
let nextTimer = 0;
new Function('document','window','setTimeout','clearTimeout',source)(page,host,fn=>{timers.set(++nextTimer,fn);return nextTimer;},id=>timers.delete(id));
const action = (key,value) => { const node = new Element(); node.dataset[key]=String(value); return node; };
const click = (id,target) => get(id).fire('click',target || get(id));
const copy = () => get('#copy-custom').dataset.hex;

assert.equal(get('#copy-custom').disabled,true,'空方案不能复制');
assert.equal(get('#custom-preview-cta').disabled,true,'空自定义方案不能应用');
assert.ok(get('#application-visual').innerHTML.includes('热图'),'应用预览默认展示热图');
assert.ok(!get('#application-visual').innerHTML.includes('柱状图'),'图表中应移除条形图');
assert.ok(get('#application-visual').innerHTML.indexOf('品类占比') < get('#application-visual').innerHTML.indexOf('热图'),'品类占比应位于热图上方');
const countControl = action('heatmapCount','');
countControl.value = '3';
get('#application-visual').fire('change',countControl);
assert.ok(get('#application-visual').innerHTML.includes('中间颜色'),'三色模式应显示中间颜色控件');
const slotControl = action('heatmapSlot',0);
slotControl.value = '4';
get('#application-visual').fire('change',slotControl);
assert.ok(get('#application-visual').innerHTML.includes('value="4" aria-pressed="true"'),'应能选用方案中指定的颜色');
countControl.value = '2';
get('#application-visual').fire('change',countControl);
assert.ok(!get('#application-visual').innerHTML.includes('中间颜色'),'两色模式应移除中间颜色控件');
click('#generated-schemes',action('previewScheme',2));
assert.ok(get('#application-source').textContent.includes('互补点睛'),'探索色彩应切换到对应方案');
assert.equal(previewButtons[2].attributes['aria-pressed'],'true','正在预览的方案应标记为选中');
click('#application-art-tab');
assert.ok(get('#application-visual').innerHTML.includes('山海之间'),'艺术视图应展示可换色的插画');
assert.ok(get('#application-source').textContent.includes('互补点睛'),'切换预览类型不应更改方案');
click('#application-chart-tab');
get('#custom-search').value=colors[0].hex;
get('#custom-search').fire('input');
assert.ok(get('#custom-results').innerHTML.includes('data-add-custom="0"'),'HEX 搜索应返回对应颜色');
assert.equal(get('#custom-results').hidden,false,'输入搜索词后应显示浮动结果');
click('#custom-results',action('addCustom',0));
assert.equal(get('#custom-results').hidden,true,'选色完成后应收起浮动结果');
assert.equal(get('#custom-search').value,'','选色完成后应清空搜索框');
assert.ok(copy().includes(colors[0].hex.toUpperCase()),'搜索结果应能加入自定义配色');
assert.ok(get('#custom-content').innerHTML.includes('class="color-wheel"'),'单色方案也应展示色盘');
click('#custom-results',action('addCustom',0));
assert.ok(get('#custom-status').textContent.includes('已在'),'重复颜色应提示且不重复加入');

const generatedBefore = get('#generated-schemes').innerHTML;
click('#custom-results',action('addCustom',1));
click('#custom-results',action('addCustom',2));
assert.equal(copy().split('；').length,3,'搜索应能连续添加颜色');
assert.equal(get('#generated-schemes').innerHTML,generatedBefore,'搜索添加自定义颜色不能改变自动方案');
click('#catalog-cards',dots[1]);
assert.ok(get('#selected-color').textContent.includes(colors[1].name),'色块点击应选择主色');
get('#catalog-plot').fire('keydown',dots[2],{key:'Enter'});
assert.ok(get('#selected-color').textContent.includes(colors[2].name),'色盘键盘操作应选择主色');
assert.equal(dots[2].attributes['aria-pressed'],'true','主色圆点应有选中状态');
click('#catalog-cards',dots[3]);
assert.ok(get('#selected-color').textContent.includes(colors[3].name),'色库应始终用于选择主色');
assert.equal(copy().split('；').length,3,'选择主色不能覆盖自定义方案');
get('#color-count').value='8'; get('#color-count').fire('change'); click('#regenerate');
assert.equal(copy().split('；').length,3,'更改自动配色数量和换组不能覆盖自定义方案');

for(let i=4;i<12;i++) click('#custom-results',action('addCustom',i));
assert.equal(copy().split('；').length,10,'自定义方案最多十色');
assert.ok(get('#custom-status').textContent.includes('最多'),'达到上限应提示');
assert.ok(!get('#custom-content').innerHTML.includes('data-remove-custom'),'色卡不能残留占位的移除按钮');
const context = get('#custom-content').fire('contextmenu',action('customIndex',0),{clientX:990,clientY:790});
assert.ok(context.prevented,'色卡右键应拦截默认菜单');
assert.equal(get('#custom-context-menu').hidden,false,'右键应打开移除菜单');
assert.equal(get('#custom-context-menu').style.left,'832px','菜单不能超出右侧边界');
assert.equal(get('#custom-context-menu').style.top,'747px','菜单不能超出下侧边界');
get('#custom-context-menu').fire('keydown',undefined,{key:'Escape'});
assert.equal(get('#custom-context-menu').hidden,true,'Escape 应关闭菜单');
assert.equal(copy().split('；').length,10,'取消菜单不能移除颜色');
get('#custom-content').fire('keydown',action('customIndex',0),{key:'F10',shiftKey:true});
assert.equal(get('#custom-context-menu').hidden,false,'键盘应能打开移除菜单');
click('#remove-custom-color');
assert.equal(copy().split('；').length,9,'移除颜色后应同步复制结果');
assert.ok(!copy().includes(colors[0].hex.toUpperCase()),'移除的颜色不能保留在复制结果中');
assert.equal(get('#custom-context-menu').hidden,true,'移除后应关闭菜单');
const outside = get('#custom-content').fire('contextmenu',new Element());
assert.ok(!outside.prevented,'非色卡区域不应拦截默认菜单');
get('#custom-content').fire('pointerdown',action('customIndex',0),{pointerType:'touch',clientX:100,clientY:100});
get('#custom-content').fire('pointermove',action('customIndex',0),{clientX:120,clientY:100});
assert.equal(timers.size,0,'触屏滑动应取消长按菜单');
get('#custom-content').fire('pointerdown',action('customIndex',0),{pointerType:'touch',clientX:100,clientY:100});
for(const fn of timers.values()) fn();
timers.clear();
assert.equal(get('#custom-context-menu').hidden,false,'触屏长按应打开菜单');
const suppressed = get('#custom-content').fire('click',action('customIndex',0));
assert.ok(suppressed.prevented && suppressed.stopped,'长按不能额外触发色值复制');
host.fire('scroll');
assert.equal(get('#custom-context-menu').hidden,true,'滚动应收起菜单');
click('#clear-custom');
assert.equal(get('#copy-custom').disabled,true,'清空后应禁用复制');
assert.equal(copy(),undefined,'清空后不能残留复制内容');
assert.ok(get('#custom-content').innerHTML.includes('custom-empty'),'清空后应恢复空状态');
get('#custom-search').value='不存在的颜色名称'; get('#custom-search').fire('input');
assert.ok(get('#custom-results').innerHTML.includes('没有找到'),'无匹配搜索应给出提示');
get('#custom-search').fire('keydown',undefined,{key:'Escape'});
assert.equal(get('#custom-results').hidden,true,'Escape 应收起搜索结果');
get('#custom-search').fire('input');
page.fire('pointerdown',new Element());
assert.equal(get('#custom-results').hidden,true,'点击外部应收起搜索结果');
click('#custom-results',action('addCustom',0));
click('#custom-preview-cta');
assert.ok(get('#application-source').textContent.includes('自定义配色'),'自定义方案也应能应用');
assert.ok(get('#application-visual').innerHTML.includes(colors[0].hex),'预览应使用自定义色值');
click('#custom-results',action('addCustom',1));
assert.ok(get('#application-source').textContent.includes('2 色'),'正在预览的自定义方案应随编辑更新');
click('#application-art-tab');
assert.ok(get('#application-visual').innerHTML.includes(colors[1].hex),'艺术预览应使用新增自定义色');
click('#clear-custom');
assert.ok(get('#application-visual').innerHTML.includes('application-empty'),'清空当前方案后不应继续展示旧配色');
assert.equal(get('#custom-preview-cta').disabled,true,'清空后应禁用自定义应用按钮');
click('#generated-schemes',action('previewScheme',0));
assert.ok(!get('#application-visual').innerHTML.includes('application-empty'),'自动方案应能重新应用');
const {applicationMarkup,describeColor,sampleCmap}=new Function(source+';return {applicationMarkup,describeColor,sampleCmap};')();
const {defaultHeatmapIndices,distance}=new Function(source+';return {defaultHeatmapIndices,distance};')();
const testPalette = ['#000000','#111111','#888888','#eeeeee','#ffffff'].map(hex=>describeColor({hex,name:'测试色'}));
assert.deepEqual(defaultHeatmapIndices(testPalette,2),[0,4],'默认两色应为全局距离最远的黑白两色');
assert.deepEqual(defaultHeatmapIndices(testPalette,3),[0,2,4],'默认三色应避免选入与端点过近的颜色');
for (const count of [2,3]) {
  const palette = colors.slice(0,10).map(describeColor);
  const chosen = defaultHeatmapIndices(palette,count);
  const minimum = indices=>Math.min(...indices.flatMap((a,i)=>indices.slice(i+1).map(b=>distance(palette[a],palette[b]))));
  for(let i=0;i<palette.length;i++) for(let j=i+1;j<palette.length;j++) {
    if(count === 2) assert.ok(minimum(chosen)>=minimum([i,j]),'两色默认值必须达到最大色差');
    else for(let k=j+1;k<palette.length;k++) assert.ok(minimum(chosen)>=minimum([i,j,k]),'三色默认值必须最大化最小两两色差');
  }
}
assert.deepEqual(defaultHeatmapIndices([],3),[],'空方案应返回空选择');
assert.equal(defaultHeatmapIndices(testPalette.slice(0,2),3).length,2,'不足三色时应使用现有两色');
assert.equal(sampleCmap(['#000000','#ffffff'],0),'#000000','渐变起点应等于低值颜色');
assert.equal(sampleCmap(['#000000','#ffffff'],1),'#ffffff','渐变终点应等于高值颜色');
assert.equal(sampleCmap(['#000000','#ffffff'],0.5),'#808080','两色渐变应按通道插值');
assert.equal(sampleCmap(['#000000','#ff0000','#ffffff'],0.5),'#ff0000','三色渐变中点应等于中间颜色');
assert.equal(sampleCmap(['#000000','#ff0000','#ffffff'],0.75),'#ff8080','三色渐变后半段应独立插值');
for(let count=1;count<=10;count++) {
  const palette=colors.slice(0,count).map(describeColor);
  const chart=applicationMarkup(palette,'chart',s=>s);
  const art=applicationMarkup(palette,'art',s=>s);
  assert.equal((chart.match(/stroke-dasharray=/g)||[]).length,count,'环形图应包含每个配色分段');
  for(const color of palette) {
    assert.ok(chart.includes(color.hex),'图表应使用方案中的每个颜色');
    assert.ok(art.includes(`fill="${color.hex}"`),'插画应使用方案中的每个颜色');
  }
  assert.ok(!chart.includes('NaN') && !art.includes('undefined'),'任意配色数量都应生成有效预览');
}
console.log('检查通过：自定义配色交互、应用预览方案切换、图表与艺术视图切换，以及 1～10 色绘制。');

// 模拟图像接口，避免测试消耗真实额度或使用真实密钥。
async function testAigc() {
  click('#generated-schemes',action('previewScheme',0));
  click('#application-aigc-tab');
  assert.equal(get('#aigc-panel').hidden,false,'应显示生成表单');
  assert.equal(get('#application-visual').hidden,true,'生成时应隐藏其他预览');
  const submit = () => get('#aigc-form').events.submit[0]({preventDefault(){}});
  await submit();
  assert.ok(get('#aigc-status').textContent.includes('密钥'),'空密钥应阻止请求');
  get('#aigc-key').value = '测试密钥';
  get('#aigc-prompt').value = '水墨山水';
  get('#aigc-model').value = 'gpt-image-1';
  get('#aigc-size').value = '1024x1024';
  const originalFetch = global.fetch;
  let request;
  try {
    global.fetch = async (url,options) => {
      request = {url,options};
      return {ok:true,json:async()=>({data:[{b64_json:'aGVsbG8='}]})};
    };
    await submit();
    assert.equal(request.url,'https://api.openai.com/v1/images/generations','密钥只能发往官方接口');
    const body = JSON.parse(request.options.body);
    assert.ok(body.prompt.includes('水墨山水') && body.prompt.includes('（#'),'请求应包含配色和补充提示词');
    assert.ok(!request.options.body.includes('测试密钥'),'密钥不能进入提示词');
    assert.equal(get('#aigc-download').href,get('#aigc-image').src,'下载应使用本地图片数据');
    click('#application-chart-tab');
    click('#application-aigc-tab');
    assert.equal(get('#aigc-prompt').value,'水墨山水','切换页签应保留输入');
    global.fetch = async()=>({ok:false,status:401});
    await submit();
    assert.ok(get('#aigc-status').textContent.includes('密钥无效'),'应解释认证错误');
    global.fetch = async()=>{ throw new TypeError('模拟网络故障'); };
    await submit();
    assert.ok(get('#aigc-status').textContent.includes('跨域'),'网络错误应提示跨域可能性');
    global.fetch = (_,options)=>new Promise((resolve,reject)=>{
      options.signal.addEventListener('abort',()=>reject(new Error('已取消')));
    });
    const waiting = submit();
    assert.equal(get('#aigc-generate').disabled,true,'等待中不能重复生成');
    click('#aigc-cancel');
    await waiting;
    assert.ok(get('#aigc-status').textContent.includes('已停止等待'),'应支持中止等待');
    assert.equal(get('#aigc-generate').disabled,false,'中止后应恢复按钮');
    click('#aigc-clear-key');
    assert.equal(get('#aigc-key').value,'','应能清除密钥');
    assert.ok(html.includes(source),'独立页面必须内联最新脚本');
    console.log('检查通过：画作生成请求、输入保留、下载、错误处理、中止和密钥清除。');
  } finally { global.fetch = originalFetch; }
}
testAigc().catch(error=>{ console.error(error); process.exitCode=1; });
