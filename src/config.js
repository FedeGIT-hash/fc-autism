export const PITCH = { length: 60, width: 38, goalWidth: 7.32, goalHeight: 2.44, goalDepth: 2.5 };
export const BALL = { radius: .22, mass: .42, airDensity: 1.20, drag: .22, magnus: .0016, gravity: 9.81 };
export const TEAMS = [
  { name:'SOL FC', code:'SOL', color:0xdaff78, hex:'#daff78', shorts:0x203432, desc:'La energía del sur', players:['A. RIVERA','D. VEGA','M. TORRES','L. CRUZ','I. SANTOS'] },
  { name:'MARINA FC', code:'MAR', color:0x91c8ee, hex:'#91c8ee', shorts:0x18344f, desc:'El orgullo de la costa', players:['N. COSTA','R. SILVA','P. LUNA','E. REYES','S. ROJAS'] },
  { name:'ROJO ATLÉTICO', code:'ROJ', color:0xf27b67, hex:'#f27b67', shorts:0x4d2425, desc:'Pasión en cada jugada', players:['J. SOLER','F. LEÓN','T. MORA','G. RÍOS','C. DUARTE'] }
];
export const VENUES = {
  sol:{name:'ESTADIO DEL SOL',tag:'TRADICIÓN · MONTAÑAS · CÉSPED NATURAL',description:'El calor de la grada. La esencia del fútbol.',accent:'#daff78'},
  marina:{name:'ARENA MARINA',tag:'MODERNO · CUBIERTA CURVA · LUZ AZUL',description:'Una nueva casa para noches inolvidables.',accent:'#83d9ff'}
};
export const DEFAULT_SETTINGS = { quality:'medium', time:'dusk', weather:'clear', duration:360, sound:false, team:0, stadium:'sol', camera:'broadcast' };
export const clamp = (n, min, max) => Math.max(min, Math.min(max,n));
