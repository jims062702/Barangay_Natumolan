import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, homePathFor } from "../../../shared/auth/AuthContext";
import { errorMessage } from "../../../shared/lib/api";
import { authApi } from "../../../shared/auth/api";

/**
 * The state and handlers of <LoginPage>, so its sections can share them.
 */
export function useSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  /*
   * Set once the password has been accepted but the account has never been
   * activated. The password is kept in state because the activation call
   * re-presents it — a code on its own must never be enough to get in.
   */
  const [activation, setActivation] = useState<{ email: string } | null>(null);
  const [code, setCode] = useState("");

  /*
   * "The email on my account is wrong and I cannot read the code."
   *
   * The dead end this opens: the office registered the account against an
   * address the resident cannot reach, so the code goes somewhere they
   * cannot look and resending it forever changes nothing. Typing a readable
   * address here sends the code THERE, and entering it both moves the
   * address across and activates the account.
   *
   * Null while the panel is closed; a string while they are typing.
   */
  const [newEmail, setNewEmail] = useState<string | null>(null);

  /*
   * The forgotten-password detour.
   *
   * "ask" collects the address, "code" collects what was emailed plus the new
   * password. Null is the ordinary sign-in form.
   */
  const [forgot, setForgot] = useState<"ask" | "code" | "set" | null>(null);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");
  const { login, activate } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result.kind === "needs-activation") {
        setActivation({ email: result.email });
        setCode("");
        setNotice(
          result.otpSent
            ? result.message
            : "We could not send the email just now. Press “Send another code” in a moment, or ask the Barangay Population Office for help."
        );
        return;
      }

      navigate(homePathFor(result.user));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const user = await activate(email, password, code.trim());
      navigate(homePathFor(user));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const response = await authApi.resendActivation({ email, password });
      setNotice(response.data.message);
      setCode("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  /** Points the account at an address they can actually read. */
  const submitNewEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const response = await authApi.changeEmailBeforeActivation({
        email,
        password,
        new_email: newEmail,
      });
      setNotice(response.data.message);
      /*
       * The panel closes and the code box is cleared, but `activation.email`
       * deliberately still names the ORIGINAL address: that is what the
       * account is called until the code proves the new one, and it is what
       * the activation call has to send.
       */
      setNewEmail(null);
      setCode("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const cancelActivation = () => {
    setActivation(null);
    setCode("");
    setNewEmail(null);
    setError("");
    setNotice("");
  };

  /**
   * Ask for a code.
   *
   * The reply is the same whether or not the address is on file — the server
   * makes sure of that — so this cannot be used to find out who has an
   * account, and the message here must not undo it by saying more.
   */
  const askForCode = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await authApi.forgotPassword({ email });
      setNotice(response.data.message);
      setForgot("code");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  /**
   * The code alone, before any password is chosen.
   *
   * The row is not consumed by this — the code is checked again when the
   * password is actually set, so getting past this screen is not on its own
   * permission to change anything.
   */
  const checkCode = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await authApi.verifyResetCode({ email, code: resetCode.trim() });
      setNotice("");
      setForgot("set");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const useCode = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await authApi.resetPassword({
        email,
        code: resetCode.trim(),
        password: newPassword,
        password_confirmation: newPasswordAgain,
      });

      /* Straight back to signing in, with the address already filled and the
         new password to type — which is the thing that proves it worked. */
      setForgot(null);
      setResetCode("");
      setNewPassword("");
      setNewPasswordAgain("");
      setPassword("");
      setNotice("Your password has been changed. Sign in with it now.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const leaveForgot = () => {
    setForgot(null);
    /* A password left visible on the way out would still be visible on the
       sign-in form, which is a different screen and possibly a different
       person at the counter. */
    setShowPassword(false);
    setError("");
    setNotice("");
    setResetCode("");
    setNewPassword("");
    setNewPasswordAgain("");
  };

  return {
    email, setEmail, password, setPassword, showPassword, setShowPassword, error, setError,
    notice, setNotice, loading, setLoading, activation, setActivation, code, setCode, forgot,
    setForgot, resetCode, setResetCode, newPassword, setNewPassword, newPasswordAgain,
    setNewPasswordAgain, login, activate, navigate, handleSubmit, submitCode, resend,
    cancelActivation, askForCode, checkCode, useCode, leaveForgot,
    newEmail, setNewEmail, submitNewEmail,
  };
}

export type SignInState = ReturnType<typeof useSignIn>;
