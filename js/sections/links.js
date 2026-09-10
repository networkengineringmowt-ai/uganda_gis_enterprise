RENDERERS.links = async function(container){
  container.innerHTML = '';

  container.appendChild(pageHead(
    'Live Links',
    'Live, publicly deployed projects — each link opens in a new tab.',
    '4 live links'
  ));

  function linkCardGrid(items){
    const grid = el('div',{style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;'});
    items.forEach(l=>{
      grid.appendChild(el('a',{href:l.url, target:'_blank', rel:'noopener noreferrer', class:'card card-pad hoverable', style:`display:block;border-left:4px solid ${l.a};text-decoration:none;color:inherit;`},[
        el('h3',{}, l.icon+'  '+l.label),
        el('p',{class:'muted', style:'margin-top:6px;'}, l.desc),
        el('p',{class:'footnote', style:'margin-top:10px;word-break:break-all;'}, l.url),
      ]));
    });
    return grid;
  }

  // ---- This portal itself (self-link, kept distinct from the bot-project links below) ----
  const enterpriseLinks = [
    { icon:'🛰️', label:'Uganda GIS Enterprise Portal', desc:'This platform — live national road-network GIS, maintenance analytics and investment dashboards.', url:'https://networkengineringmowt-ai.github.io/uganda_gis_enterprise/', a:'var(--neon-cyan)' },
  ];
  container.appendChild(sectionBlock('🚀 Live Verification & Enterprise Links', 'Live, publicly deployed MoWT enterprise systems.', linkCardGrid(enterpriseLinks)));

  // ---- Bot / automation projects (separate GitHub account — priscananjehe1996/priezent) ----
  const botResultLinks = [
    { icon:'⚙️', label:'Result Engine Dashboard', desc:'Automated results-tracking dashboard.', url:'https://priscananjehe1996.github.io/priezent/result_engine.html', a:'var(--neon-blue)' },
    { icon:'☀️', label:'3D Solar Agent App', desc:'Interactive 3D solar agent application.', url:'https://priscananjehe1996.github.io/priezent/', a:'var(--neon-orange)' },
    { icon:'📡', label:'Mindscape Telemetry', desc:'Telemetry and monitoring interface.', url:'https://priscananjehe1996.github.io/priezent/prisca_mindscape.html', a:'var(--neon-magenta)' },
  ];
  container.appendChild(sectionBlock('🤖 Bot Results', 'Live, publicly deployed automation projects.', linkCardGrid(botResultLinks)));
};
