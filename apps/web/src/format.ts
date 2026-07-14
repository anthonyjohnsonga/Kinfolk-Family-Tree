export const inputDate=(value:string|null)=>value?.slice(0,10)||'';
export const year=(value:string|null)=>value?new Date(value).getUTCFullYear():'?';
export const displayDate=(value:string)=>new Date(value).toLocaleDateString(undefined,{timeZone:'UTC'});
