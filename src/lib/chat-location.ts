/** Coordinates are supplied by a device fix or an explicit selected point, never a fallback city. */
export function validatedLocation(input:unknown):Record<string,string>{
 if(!input||typeof input!=='object')throw new Error('Coordonnées de position requises.');
 const value=input as Record<string,unknown>;
 const coordinate=(key:string,max:number)=>{const raw=value[key];if((typeof raw!=='string'&&typeof raw!=='number')||String(raw).trim()==='')throw new Error('Coordonnées invalides.');const number=Number(raw);if(!Number.isFinite(number)||Math.abs(number)>max)throw new Error('Coordonnées invalides.');return String(number);};
 return {latitude:coordinate('latitude',90),longitude:coordinate('longitude',180),title:String(value.title||'Position partagée').slice(0,160),accuracyDescription:String(value.accuracyDescription||'').slice(0,160)};
}
