/** Display-space colors; engineering materials remain physically lit and unchanged. */
export const APPEARANCE_PROFILES = Object.freeze({
  light: Object.freeze({ background:'#f3f3f1', contour:'#303337', feature:'#74797f', context:'#73777c', keyline:'#242629', gridMajor:'#85898d', gridMinor:'#b8bbbd', gridOpacity:.30 }),
  dark: Object.freeze({ background:'#1b1b1b', contour:'#e5e8eb', feature:'#969da5', context:'#bcc2c8', keyline:'#101215', gridMajor:'#7f858c', gridMinor:'#555c63', gridOpacity:.28 })
});
export const getAppearanceProfile = mode => APPEARANCE_PROFILES[mode] || APPEARANCE_PROFILES.light;
/** Shader overlays operate after the output transform; their uniforms are display sRGB. */
export const displayChannels = hex => [1,3,5].map(index => parseInt(hex.slice(index,index+2),16)/255);

/** The Engineering output pass uses Three's Neutral tone mapping at exposure 1.
 * Its dark offset and highlight compression also affect a Color background.
 * Invert that transform for the background only, so both rendering pipelines
 * display the same authored sRGB canvas without changing physical materials. */
export function engineeringBackgroundChannels(hex) {
  let color=displayChannels(hex).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  const outputPeak=Math.max(...color),start=.76,d=.24;
  if(outputPeak>=start){
    const peak=d*d/(1-Math.min(outputPeak,.9999))-d+start;
    const desaturation=1-1/(.15*(peak-outputPeak)+1);
    color=color.map(value=>(value-desaturation*outputPeak)/(1-desaturation)*peak/outputPeak);
  }
  const minimum=Math.min(...color),offset=minimum<.04?Math.sqrt(Math.max(0,minimum)/6.25)-minimum:.04;
  return color.map(value=>value+offset);
}

export function interactionKeyline(mode,accent='#ff6840') {
  const rgb=displayChannels(accent),brightness=rgb.reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  return mode==='dark'&&brightness<.25?'#cbd0d4':getAppearanceProfile(mode).keyline;
}
