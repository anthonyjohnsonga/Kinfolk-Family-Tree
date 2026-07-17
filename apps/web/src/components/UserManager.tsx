import { useEffect, useState, type FormEvent } from 'react';
import type { SessionUser, UserAccount } from '../types';
import { api } from '../api';
import { Status } from './Status';

const roleOptions = [
  ['admin', 'Administrator'],
  ['editor', 'Editor'],
  ['viewer', 'Viewer'],
];

export function UserManager({ me }: { me: SessionUser }) {
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setError('');
    try {
      setUsers(await api<UserAccount[]>('/api/users'));
    } catch (x) {
      setError((x as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await load();
      setNotice(done);
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function changeRole(user: UserAccount, role: string) {
    void run(async () => {
      await api(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ role }) });
    }, `Updated ${user.username}'s role.`);
  }
  function resetPassword(user: UserAccount) {
    const password = prompt(`New password for ${user.username} (at least 12 characters):`);
    if (password === null) return;
    if (password.length < 12) {
      setError('Passwords need at least 12 characters.');
      return;
    }
    void run(async () => {
      await api(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ password }) });
    }, `Changed ${user.username}'s password. Their other sessions were signed out.`);
  }
  function remove(user: UserAccount) {
    if (!confirm(`Delete the account "${user.username}"? This cannot be undone.`)) return;
    void run(async () => {
      await api(`/api/users/${user.id}`, { method: 'DELETE' });
    }, `Deleted ${user.username}.`);
  }
  function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void run(async () => {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: data.get('username'),
          password: data.get('password'),
          role: data.get('role'),
        }),
      });
      form.reset();
    }, 'Account created.');
  }
  if (!users)
    return error ? (
      <Status message={error} onRetry={() => void load()} />
    ) : (
      <div className="loading-state">
        <span />
        <p>Loading accounts…</p>
      </div>
    );
  return (
    <div className="user-manager">
      <p className="relationship-empty">
        Administrators manage accounts, editors change family data, and viewers have read-only
        access.
      </p>
      <ul className="user-list">
        {users.map((user) => (
          <li key={user.id}>
            <strong>
              {user.username}
              {user.id === me.id && <em> (you)</em>}
            </strong>
            <select
              aria-label={`Role for ${user.username}`}
              value={user.role}
              disabled={busy || user.id === me.id}
              onChange={(event) => changeRole(user, event.target.value)}
            >
              {roleOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => resetPassword(user)}
            >
              Set password
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy || user.id === me.id}
              onClick={() => remove(user)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <form className="user-add" onSubmit={addUser}>
        <h3>Add an account</h3>
        <input
          name="username"
          required
          minLength={3}
          maxLength={40}
          pattern="[A-Za-z0-9._-]+"
          placeholder="Username"
          autoComplete="off"
          disabled={busy}
        />
        <input
          name="password"
          type="password"
          required
          minLength={12}
          maxLength={128}
          placeholder="Password (12+ characters)"
          autoComplete="new-password"
          disabled={busy}
        />
        <select
          name="role"
          defaultValue="editor"
          aria-label="Role for the new account"
          disabled={busy}
        >
          {roleOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <button disabled={busy}>{busy ? 'Working…' : 'Create account'}</button>
      </form>
      {error && <Status message={error} />}
      {notice && <p className="notice">{notice}</p>}
    </div>
  );
}
