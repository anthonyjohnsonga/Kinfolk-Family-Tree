import { useEffect,useState,type FormEvent } from 'react';
import type { AuthStatus } from './types';
import { api } from './api';
import { Status } from './components/Status';
import { KinfolkApp } from './components/KinfolkApp';

export function App(){
 const [status,setStatus]=useState<AuthStatus|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){setError('');try{setStatus(await api<AuthStatus>('/api/auth/status'))}catch(x){setError((x as Error).message)}}
 useEffect(()=>{void refresh();const expired=()=>void refresh();window.addEventListener('kinfolk:unauthorized',expired);return()=>window.removeEventListener('kinfolk:unauthorized',expired)},[]);
 async function authenticate(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const d=new FormData(e.currentTarget),password=String(d.get('password')||'');if(status?.setupRequired&&password!==d.get('confirmPassword')){setError('The passwords do not match.');setBusy(false);return}try{await api(status?.setupRequired?'/api/auth/setup':'/api/auth/login',{method:'POST',body:JSON.stringify({username:d.get('username'),password})});await refresh()}catch(x){setError((x as Error).message)}finally{setBusy(false)}}
 async function logout(){setBusy(true);try{await api('/api/auth/logout',{method:'POST'});await refresh()}finally{setBusy(false)}}
 if(!status)return <main className="auth-page"><div className="loading-state"><span/><p>{error?'Unable to connect':'Checking server security…'}</p>{error&&<Status message={error} onRetry={()=>void refresh()}/>}</div></main>;
 if(!status.authenticated)return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><i>K</i><strong>Kinfolk</strong></div><small>{status.setupRequired?'FIRST-RUN SETUP':'PRIVATE FAMILY TREE'}</small><h1>{status.setupRequired?'Create your administrator':'Welcome back'}</h1><p>{status.setupRequired?'This account will protect every family tree stored on this server.':'Sign in to access the family trees on this server.'}</p><form onSubmit={authenticate}><label>Username<input name="username" required minLength={status.setupRequired?3:1} maxLength={40} autoComplete="username" pattern={status.setupRequired?'[A-Za-z0-9._-]+':undefined} disabled={busy}/></label><label>Password<input name="password" type="password" required minLength={status.setupRequired?12:1} maxLength={128} autoComplete={status.setupRequired?'new-password':'current-password'} disabled={busy}/></label>{status.setupRequired&&<label>Confirm password<input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy}/></label>}{error&&<Status message={error}/>}<button disabled={busy}>{busy?'Please wait…':status.setupRequired?'Create administrator':'Sign in'}</button></form>{status.setupRequired&&<p className="auth-note">Use at least 12 characters and store the password securely. Kinfolk cannot recover it for you.</p>}</section></main>;
 return <KinfolkApp username={status.user?.username||'admin'} onLogout={()=>void logout()} logoutBusy={busy}/>
}
