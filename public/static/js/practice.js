// Intersection Observer to reveal panels & cards
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){ 
      entry.target.classList.add('visible'); 
    }
  });
}, {threshold:.18});

document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

// Scroll indicator logic - UPDATED section IDs including bridge-mode
const sections = ['top','language','resources','bridge-mode'].map(id=>document.getElementById(id));
const nodes = [...document.querySelectorAll('.scroll-indicator .node')];

const setActiveNode = ()=>{
  let idx = 0; let best = 0;
  sections.forEach((sec,i)=>{
    if(!sec) return;
    
    // Skip hidden sections
    if(sec.style.display === 'none') return;
    
    const rect = sec.getBoundingClientRect();
    const visible = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
    if(visible > best){ best = visible; idx = i; }
  });
  
  // Only activate nodes for visible sections
  nodes.forEach((n,i)=>{
    const section = sections[i];
    const shouldBeActive = i === idx && section && section.style.display !== 'none';
    n.classList.toggle('active', shouldBeActive);
  });
};
setActiveNode();
addEventListener('scroll', setActiveNode, {passive:true});
addEventListener('resize', setActiveNode);

// Parallax the global glow for seamless continuity
const glow = document.querySelector('.global-glow');
const parallax = ()=>{
  const y = window.scrollY * 0.10; // slower than scroll
  const x = Math.sin(window.scrollY/900) * 50; // gentle lateral drift
  glow?.style.setProperty('--gx', x.toFixed(2) + 'px');
  glow?.style.setProperty('--gy', y.toFixed(2) + 'px');
  const h = document.documentElement.scrollHeight - innerHeight;
  const t = h>0 ? window.scrollY/h : 0;
  glow.style.opacity = (0.62 + 0.22*Math.sin(t*Math.PI)).toFixed(3);
};
if(glow){
  parallax();
  addEventListener('scroll', parallax, {passive:true});
  addEventListener('resize', parallax);
}

// Click feedback on option cards - UPDATED with Netlify Function support
document.querySelectorAll('[data-action]').forEach(card=>{
  card.addEventListener('click', async (e)=>{
    const label = card.getAttribute('data-action');
    card.style.boxShadow = '0 0 0 2px var(--accent2)';
    
    // Log action for analytics (future Netlify Function)
    console.log('Selected:', label);
    
    // Route based on action type
    switch(label) {
      case 'lessons':
        window.location.href = '/templates/lessons.html';
        break;
      case 'practice':
        window.location.href = '/templates/practice_home.html';
        break;
      case 'glossary':
        window.location.href = '/templates/glossary.html';
        break;
      case 'scholarships':
        window.location.href = '/templates/scholarships.html';
        break;
      default:
        console.log('Navigation for', label, 'not implemented yet');
    }
    
    setTimeout(()=> card.style.boxShadow = '', 300);
  });
});

// Motion toggle for demo
const toggle = document.getElementById('toggle-motion');
toggle?.addEventListener('click', ()=>{
  const reduced = document.documentElement.classList.toggle('reduce-motion');
  document.documentElement.style.setProperty('--grid', reduced ? 'transparent' : 'rgba(16,185,129,.07)');
});

// FUTURE: Add Netlify Function calls here for:
// - Analytics tracking (/.netlify/functions/trackEvent)
// - User preferences (/.netlify/functions/savePreferences)
// - Lesson progress (/.netlify/functions/updateProgress)
// Example:
// async function trackEvent(eventName, eventData) {
//   try {
//     await fetch('/.netlify/functions/trackEvent', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ event: eventName, data: eventData })
//     });
//   } catch(error) {
//     console.error('Error tracking event:', error);
//   }
// }