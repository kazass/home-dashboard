/* 3.5 appearance is independent of layout and household state. */
(() => {
  const palette = (bg,surface,text,muted,accent,on,border) => ({'--bg':bg,'--surface':surface,'--text':text,'--text-muted':muted,'--accent':accent,'--accent-text':on,'--border':border,'--today-bg':`color-mix(in srgb, ${accent} 12%, ${surface})`,'--surface-soft':`color-mix(in srgb, ${accent} 10%, ${surface})`,'--surface-warm':surface,'--hero-bg':surface,'--hero-text':text,'--type-recurring':accent});
  const themes={
    ink:{name:'Ink',swatch:'#343b48',light:palette('#f3f4f6','#ffffff','#20242c','#5c6370','#303641','#ffffff','#dce0e6'),dark:palette('#13151a','#202329','#f5f6f8','#b5bbc6','#e1e5ec','#16191f','#363c46')},
    cobalt:{name:'Cobalt',swatch:'#829ff6',light:palette('#f1f4fb','#ffffff','#17233e','#57647c','#3159d8','#ffffff','#dce3f0'),dark:palette('#111721','#202936','#f2f6fc','#b1bdd0','#a4baff','#17223c','#354253')},
    cherry:{name:'Cherry',swatch:'#bb3559',light:palette('#fcf3f6','#ffffff','#3d2530','#7b5968','#b02b50','#ffffff','#eddae1'),dark:palette('#21151e','#30212c','#fff0f5','#d2afbf','#f19cb9','#361323','#503647')},
    volt:{name:'Volt',swatch:'#cfed77',light:palette('#f3f5ed','#ffffff','#26311c','#5d684d','#45650b','#ffffff','#dce3cb'),dark:palette('#171b15','#252c20','#f3f7e9','#b7c2a8','#cfed77','#24300e','#3c4932')},
    copper:{name:'Copper',swatch:'#e7aa7b',light:palette('#f8f2ed','#ffffff','#3b2a20','#786253','#9b4d20','#ffffff','#e8dcd1'),dark:palette('#201914','#30261f','#fcf1e8','#cbb7a7','#e7aa7b','#352012','#4d3d32')}
  };
  Object.keys(HD_SETTINGS.THEMES).forEach(key=>delete HD_SETTINGS.THEMES[key]);
  Object.assign(HD_SETTINGS.THEMES,themes);
})();
