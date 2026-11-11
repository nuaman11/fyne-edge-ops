"use client";

import { useActionState, useState } from "react";
import { changePassword, login, setupAdmin, type FormState } from "@/app/actions/auth";

function Msg({ state }: { state: FormState }) {
  if (state?.error) return <div className="err" role="alert">{state.error}</div>;
  if (state?.success) return <div className="okmsg" role="status">{state.success}</div>;
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="box">
      <h2>Sign in</h2>
      <p>Use the email and password your admin gave you.</p>
      <Msg state={state} />
      <div className="form">
        <div className="f full"><label className="l" htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="f full"><label className="l" htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      </div>
      <button className="btn primary block" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="fine">Forgot your password? Ask an admin to reset it.</p>
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAdmin, undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="box">
      <h2>Create the admin account</h2>
      <p>This is a one-time step. You can add more admins and users once you’re in.</p>
      <Msg state={state} />
      <div className="form">
        <div className="f full"><label className="l" htmlFor="name">Your name</label><input id="name" name="name" type="text" required autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="f full"><label className="l" htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="f full"><label className="l" htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /><span className="help">At least 10 characters.</span></div>
        <div className="f full"><label className="l" htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></div>
      </div>
      <button className="btn primary block" disabled={pending}>{pending ? "Creating…" : "Create admin and sign in"}</button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="panel narrow" key={state?.success}>
      <h2>Change password</h2>
      <Msg state={state} />
      <div className="form" style={{ marginTop: 10 }}>
        <div className="f"><label className="l" htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required /></div>
        <div className="f"><label className="l" htmlFor="password">New password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /><span className="help">At least 10 characters.</span></div>
        <div className="f"><label className="l" htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></div>
      </div>
      <div className="foot" style={{ marginTop: 14 }}><button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Update password"}</button></div>
    </form>
  );
}
