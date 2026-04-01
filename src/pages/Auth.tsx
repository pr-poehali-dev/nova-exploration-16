import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Step = "phone" | "code" | "profile";

export default function Auth() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [demoCode, setDemoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("7") || digits.startsWith("8")) {
      const num = digits.slice(1);
      let formatted = "+7";
      if (num.length > 0) formatted += " (" + num.slice(0, 3);
      if (num.length >= 3) formatted += ") " + num.slice(3, 6);
      if (num.length >= 6) formatted += "-" + num.slice(6, 8);
      if (num.length >= 8) formatted += "-" + num.slice(8, 10);
      return formatted;
    }
    return "+" + digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value);
    setError("");
  };

  const cleanPhone = (p: string) => "+" + p.replace(/\D/g, "");

  const handleSendCode = async () => {
    const cleanedPhone = cleanPhone(phone);
    if (cleanedPhone.length < 10) {
      setError("Введите корректный номер телефона");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { ok, data } = await authApi.sendCode(cleanedPhone);
      if (ok) {
        setDemoCode(data.demo_code || "");
        setStep("code");
      } else {
        setError(data.error || "Ошибка отправки кода");
      }
    } catch {
      setError("Ошибка сети. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError("Введите 6-значный код");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const cleanedPhone = cleanPhone(phone);
      const { ok, data } = await authApi.verifyCode(cleanedPhone, code, firstName, lastName);
      if (ok) {
        if (data.is_new_user) {
          setIsNewUser(true);
          setStep("profile");
          localStorage.setItem("epicgram_token", data.token);
          login(data.token, data.user);
        } else {
          login(data.token, data.user);
          navigate("/");
        }
      } else {
        setError(data.error || "Неверный код");
      }
    } catch {
      setError("Ошибка сети. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const { ok, data } = await authApi.updateProfile({
        first_name: firstName || "Пользователь",
        last_name: lastName,
        username: "",
        bio: "",
      });
      if (ok) {
        login(localStorage.getItem("epicgram_token")!, data.user);
        navigate("/");
      } else {
        setError(data.error || "Ошибка сохранения");
      }
    } catch {
      setError("Ошибка сети. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = step === "phone" ? 0 : step === "code" ? 1 : 2;

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-300/10 rounded-full blur-2xl" />

        <div className="relative z-10 text-center">
          {/* Icon */}
          <div className="w-24 h-24 mx-auto mb-6 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-2xl border border-white/30">
            <svg viewBox="0 0 24 24" className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>

          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Epicgram</h1>
          <p className="text-purple-200 text-lg mb-10 max-w-xs mx-auto leading-relaxed">
            Общайтесь легко и безопасно с близкими людьми
          </p>

          {/* Features */}
          <div className="space-y-4 text-left max-w-xs mx-auto">
            {[
              { icon: "🔒", text: "Сквозное шифрование" },
              { icon: "⚡", text: "Мгновенная доставка сообщений" },
              { icon: "🌐", text: "Каналы и группы" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/20">
                <span className="text-xl">{f.icon}</span>
                <span className="text-white/90 text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0f0f14] p-6 lg:p-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Epicgram</h1>
        </div>

        <div className="w-full max-w-md">
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-8">
            {["Телефон", "Код", "Профиль"].map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      i < stepIndex
                        ? "bg-violet-500 text-white"
                        : i === stepIndex
                        ? "bg-violet-500 text-white ring-4 ring-violet-500/30"
                        : "bg-white/10 text-white/30"
                    }`}
                  >
                    {i < stepIndex ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${i === stepIndex ? "text-white" : "text-white/30"}`}>
                    {label}
                  </span>
                </div>
                {i < 2 && (
                  <div className={`h-px flex-1 transition-all duration-500 ${i < stepIndex ? "bg-violet-500" : "bg-white/10"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Form card */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 shadow-2xl">

            {/* Step: Phone */}
            {step === "phone" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Добро пожаловать</h2>
                  <p className="text-white/50 text-sm">Введите номер телефона для входа или регистрации</p>
                </div>

                <div className="space-y-2">
                  <label className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                    Номер телефона
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                      </svg>
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                      placeholder="+7 (999) 999-99-99"
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-white/20 outline-none transition-all text-base"
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleSendCode}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-all duration-200 text-base shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Отправка...
                    </>
                  ) : (
                    <>
                      Получить код
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Step: Code */}
            {step === "code" && (
              <div className="space-y-6">
                <div>
                  <button
                    onClick={() => { setStep("phone"); setCode(""); setError(""); }}
                    className="flex items-center gap-1 text-violet-400 text-sm mb-4 hover:text-violet-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Назад
                  </button>
                  <h2 className="text-2xl font-bold text-white mb-1">Введите код</h2>
                  <p className="text-white/50 text-sm">
                    Код отправлен на{" "}
                    <span className="text-violet-400 font-medium">{phone}</span>
                  </p>
                </div>

                {demoCode && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-emerald-400 text-sm font-semibold">🔑 Демо-режим</span>
                    </div>
                    <p className="text-emerald-300 text-sm">
                      Ваш код:{" "}
                      <span className="font-mono font-bold text-lg tracking-widest">{demoCode}</span>
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                    Код подтверждения
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                    placeholder="— — — — — —"
                    maxLength={6}
                    className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-2xl px-4 py-4 text-white placeholder-white/20 outline-none transition-all text-3xl tracking-[0.6em] text-center font-mono"
                    autoFocus
                  />
                  <p className="text-white/30 text-xs text-center">6 цифр</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleVerifyCode}
                  disabled={loading || code.length !== 6}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-all duration-200 text-base shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Проверка...
                    </>
                  ) : (
                    <>
                      Подтвердить
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Step: Profile */}
            {step === "profile" && isNewUser && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Создайте профиль</h2>
                  <p className="text-white/50 text-sm">Расскажите немного о себе</p>
                </div>

                {/* Avatar preview */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-4xl font-bold text-white shadow-xl shadow-violet-500/30">
                      {firstName ? firstName[0].toUpperCase() : (
                        <svg className="w-10 h-10 text-white/50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-violet-500 rounded-xl flex items-center justify-center border-2 border-[#0f0f14]">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                      Имя <span className="text-violet-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ваше имя"
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-2xl px-4 py-4 text-white placeholder-white/20 outline-none transition-all"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                      Фамилия <span className="text-white/30">(необязательно)</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
                      placeholder="Ваша фамилия"
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-2xl px-4 py-4 text-white placeholder-white/20 outline-none transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleSaveProfile}
                  disabled={loading || !firstName.trim()}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-all duration-200 text-base shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Сохранение...
                    </>
                  ) : (
                    <>
                      Начать общение
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-white/20 text-xs mt-6">
            Используя Epicgram, вы соглашаетесь с{" "}
            <span className="text-violet-400/60 hover:text-violet-400 cursor-pointer transition-colors">условиями использования</span>
          </p>
        </div>
      </div>
    </div>
  );
}
