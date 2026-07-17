import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { Status } from './Status';

export function AccountPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get('newPassword') || '');
    if (newPassword !== data.get('confirmPassword')) {
      setError('The new passwords do not match.');
      setNotice('');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: data.get('currentPassword'),
          newPassword,
        }),
      });
      form.reset();
      setNotice('Password changed. Your other devices were signed out.');
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="account-panel" onSubmit={submit}>
      <h3>Change your password</h3>
      <p className="relationship-empty">
        You stay signed in on this device; every other session is signed out.
      </p>
      <label>
        Current password
        <input
          name="currentPassword"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
          disabled={busy}
        />
      </label>
      <label>
        New password
        <input
          name="newPassword"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          disabled={busy}
        />
      </label>
      <label>
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          disabled={busy}
        />
      </label>
      {error && <Status message={error} />}
      {notice && <p className="notice">{notice}</p>}
      <footer>
        <span />
        <button disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </footer>
    </form>
  );
}
