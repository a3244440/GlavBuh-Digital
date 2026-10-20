// Общая вёрстка юридических документов: оглавление слева, пронумерованные разделы справа, версии на русском и казахском.
// Раздел: [id, заголовок, содержимое]; содержимое — массив абзацев, {before, list, after} или {kv: [[подпись, значение], ...]}.
function body(content){
 if(Array.isArray(content))return content.map(t=>`<p>${t}</p>`).join('');
 if(content.kv)return `<div class="kv policy-kv">${content.kv.map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>`;
 return `${content.before?`<p>${content.before}</p>`:''}<ul class="ticks">${content.list.map(t=>`<li>${t}</li>`).join('')}</ul>${content.after?`<p>${content.after}</p>`:''}`;
}
function article({lang,title,edition,sections}){
 return `<article class="policy" id="${lang}" lang="${lang==='ru'?'ru':'kk'}"><aside class="policy-toc box"><span class="mono">${edition}</span><h2>${title}</h2><ol>${sections.map(([id,t])=>`<li><a href="#${lang}-${id}">${t}</a></li>`).join('')}</ol></aside><div class="policy-body">${sections.map(([id,t,content],i)=>`<section class="box pad policy-sec" id="${lang}-${id}"><span class="mono red-t">${String(i+1).padStart(2,'0')}</span><h3>${t}</h3>${body(content)}</section>`).join('')}</div></article>`;
}
export function legalPage({crumb,heading,lead,documents}){return `<section class="wrap ph source-page long legal-hero"><div class="crumbs"><a href="/">Главная</a> / ${crumb}</div><div class="ph-in"><div><span class="pill"><i></i>ГЛАВБУХ / ДОКУМЕНТЫ</span><h1>${heading}</h1></div><div><p class="lead">${lead}</p><nav class="toc" aria-label="Язык документа"><a href="#ru"><span class="mono">RU</span>Русский</a><a href="#kk"><span class="mono">KZ</span>Қазақша</a></nav></div></div></section><section class="section tight"><div class="wrap">${documents.map(article).join('')}</div></section>`}
