// public/static/js/practice.js
// Intersection Observer + parallax + settings toggle

// Reveal animations
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting) entry.target.classList.add('visible');
  });
}, {threshold:.18});
document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

// Scroll indicator
const sections = ['top','language','resources','bridge-mode'].map(id=>document.getElementById(id));
const nodes = [...document.querySelectorAll('.scroll-indicator .node')];

const setActiveNode = ()=>{
  let idx = 0; let best = 0;
  sections.forEach((sec,i)=>{
    if(!sec || sec.style.display === 'none') return;
    const rect = sec.getBoundingClientRect();
    const visible = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
    if(visible > best){ best = visible; idx = i; }
  });
  
  nodes.forEach((n,i)=>{
    const section = sections[i];
    const shouldBeActive = i === idx && section && section.style.display !== 'none';
    n.classList.toggle('active', shouldBeActive);
  });
};
setActiveNode();
addEventListener('scroll', setActiveNode, {passive:true});
addEventListener('resize', setActiveNode);

// Parallax glow
const glow = document.querySelector('.global-glow');
const parallax = ()=>{
  if(!glow) return;
  const y = window.scrollY * 0.10;
  const x = Math.sin(window.scrollY/900) * 50;
  glow.style.setProperty('--gx', x.toFixed(2) + 'px');
  glow.style.setProperty('--gy', y.toFixed(2) + 'px');
  const h = document.documentElement.scrollHeight - innerHeight;
  const t = h>0 ? window.scrollY/h : 0;
  glow.style.opacity = (0.62 + 0.22*Math.sin(t*Math.PI)).toFixed(3);
};
if(glow){
  parallax();
  addEventListener('scroll', parallax, {passive:true});
  addEventListener('resize', parallax);
}

// Card click feedback
document.querySelectorAll('[data-action]').forEach(card=>{
  card.addEventListener('click', ()=>{
    card.style.boxShadow = '0 0 0 2px var(--accent2)';
    setTimeout(()=> card.style.boxShadow = '', 300);
  });
});

// SETTINGS TOGGLE (client-side panel)
(function(){
  const btn = document.getElementById('settings-toggle') || document.querySelector('[data-settings-toggle]');
  const panel = document.getElementById('settings-panel') || document.querySelector('[data-settings-panel]');

  if(!btn || !panel) return;

  panel.classList.add('hidden');
  const isOpen = () => !panel.classList.contains('hidden');
  const setOpen = (open) => panel.classList.toggle('hidden', !open);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!isOpen());
  });

  document.addEventListener('click', (e) => {
    if(!panel.contains(e.target) && !btn.contains(e.target) && isOpen()) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && isOpen()) setOpen(false);
  });
})();