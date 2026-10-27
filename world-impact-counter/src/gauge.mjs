import { quantityGauge } from './engine.mjs';
const ns = 'http://www.w3.org/2000/svg';
const num = new Intl.NumberFormat(undefined,{maximumFractionDigits:1});
function svgElement(tag, attributes) {
  const element = document.createElementNS(ns,tag);
  for (const [key,value] of Object.entries(attributes)) element.setAttribute(key,value);
  return element;
}
export function createQuantityGauge(unit) {
  const figure = document.createElement('figure');
  figure.className = 'quantity-gauge';
  figure.setAttribute('role','img');
  const svg = svgElement('svg',{viewBox:'0 0 280 160','aria-hidden':'true',focusable:'false'});
  const d = 'M 25 132 A 115 115 0 0 1 255 132';
  svg.append(svgElement('path',{d,class:'gauge-track',pathLength:'100'}));
  const fill = svgElement('path',{d,class:'gauge-fill',pathLength:'100','stroke-dasharray':'0 100'});
  svg.append(fill);
  for (let i=0;i<=10;i++) {
    const a = Math.PI + Math.PI*i/10;
    svg.append(svgElement('line',{x1:140+Math.cos(a)*98,y1:132+Math.sin(a)*98,x2:140+Math.cos(a)*(i%5===0?84:91),y2:132+Math.sin(a)*(i%5===0?84:91),class:'gauge-tick'}));
  }
  const needle = svgElement('line',{x1:'140',y1:'132',x2:'52',y2:'132',class:'gauge-needle'});
  svg.append(needle,svgElement('circle',{cx:'140',cy:'132',r:'5',class:'gauge-pin'}));
  const axis = document.createElement('figcaption'); axis.className = 'gauge-axis';
  figure.append(svg,axis);
  return {element:figure, update(value) {
    const state = quantityGauge(value);
    if (!state) { figure.setAttribute('aria-label','Amount gauge unavailable'); fill.setAttribute('stroke-dasharray','0 100'); axis.textContent='Unavailable'; return; }
    const angle = Math.PI + state.fraction * Math.PI;
    fill.setAttribute('stroke-dasharray',`${state.fraction*100} 100`);
    needle.setAttribute('x2',String(140+Math.cos(angle)*77));
    needle.setAttribute('y2',String(132+Math.sin(angle)*77));
    axis.textContent=`0 to ${num.format(state.maximum)} ${unit}`;
    figure.setAttribute('aria-label',`Estimated amount gauge: approximately ${num.format(value)} ${unit}. Automatically expanding quantity axis from 0 to ${num.format(state.maximum)} ${unit}; not a severity score.`);
  }};
}
