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
    const raw = e.target.value;
    setPhone(raw);
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
      const { ok, data } = await authApi.verifyCode(
        cleanedPhone,
        code,
        firstName,
        lastName
      );
      if (ok) {
        if (data.is_new_user) {
          setIsNewUser(true);
          setStep("profile");
          // Временно сохраняем токен для profile step
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

  return (
    <div className="min-h-screen bg-[#17212b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#2ea6ff] to-[#1a73e8] flex items-center justify-center shadow-2xl">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              <path d="M9.5 6.5c0 .83-.67 1.5-1.5 1.5S6.5 7.33 6.5 6.5 7.17 5 8 5s1.5.67 1.5 1.5zM17.5 6.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5S15.17 5 16 5s1.5.67 1.5 1.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">Epicgram</h1>
          <p className="text-[#708fa0] text-sm mt-1">Быстрый и безопасный мессенджер</p>
        </div>

        {/* Card */}
        <div className="bg-[#1c2733] rounded-2xl p-6 shadow-2xl border border-[#253344]">
          {step === "phone" && (
            <>
              <h2 className="text-white text-xl font-semibold mb-1">Войти в Epicgram</h2>
              <p className="text-[#708fa0] text-sm mb-6">
                Введите ваш номер телефона для входа или регистрации
              </p>
              <div className="mb-4">
                <label className="block text-[#708fa0] text-xs font-medium mb-2 uppercase tracking-wider">
                  Номер телефона
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                  placeholder="+7 (999) 999-99-99"
                  className="w-full bg-[#253344] border border-[#2f4053] rounded-xl px-4 py-3 text-white placeholder-[#4a6278] focus:outline-none focus:border-[#2ea6ff] focus:ring-1 focus:ring-[#2ea6ff] transition-all text-lg"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-[#ff6b6b] text-sm mb-4 flex items-center gap-1">
                  <span>⚠️</span> {error}
                </p>
              )}
              <button
                onClick={handleSendCode}
                disabled={loading}
                className="w-full bg-[#2ea6ff] hover:bg-[#1a8de0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all text-base"
              >
                {loading ? "Отправка..." : "Продолжить"}
              </button>
            </>
          )}

          {step === "code" && (
            <>
              <button
                onClick={() => { setStep("phone"); setCode(""); setError(""); }}
                className="flex items-center gap-1 text-[#2ea6ff] text-sm mb-4 hover:opacity-80 transition-opacity"
              >
                ← Назад
              </button>
              <h2 className="text-white text-xl font-semibold mb-1">Введите код</h2>
              <p className="text-[#708fa0] text-sm mb-1">
                Мы отправили код на номер
              </p>
              <p className="text-white font-medium mb-4">{phone}</p>

              {demoCode && (
                <div className="bg-[#1a3a2a] border border-[#2a5a3a] rounded-xl p-3 mb-4">
                  <p className="text-[#4eca82] text-xs font-medium">🔑 Демо-режим</p>
                  <p className="text-[#4eca82] text-sm">Ваш код: <strong className="text-lg">{demoCode}</strong></p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-[#708fa0] text-xs font-medium mb-2 uppercase tracking-wider">
                  Код подтверждения
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full bg-[#253344] border border-[#2f4053] rounded-xl px-4 py-3 text-white placeholder-[#4a6278] focus:outline-none focus:border-[#2ea6ff] focus:ring-1 focus:ring-[#2ea6ff] transition-all text-2xl tracking-[0.5em] text-center"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-[#ff6b6b] text-sm mb-4 flex items-center gap-1">
                  <span>⚠️</span> {error}
                </p>
              )}
              <button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                className="w-full bg-[#2ea6ff] hover:bg-[#1a8de0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all text-base"
              >
                {loading ? "Проверка..." : "Подтвердить"}
              </button>
            </>
          )}

          {step === "profile" && isNewUser && (
            <>
              <h2 className="text-white text-xl font-semibold mb-1">Ваш профиль</h2>
              <p className="text-[#708fa0] text-sm mb-6">
                Расскажите немного о себе
              </p>
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#2ea6ff] to-[#1a73e8] flex items-center justify-center text-3xl font-bold text-white">
                  {firstName ? firstName[0].toUpperCase() : "?"}
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-[#708fa0] text-xs font-medium mb-2 uppercase tracking-wider">
                  Имя *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ваше имя"
                  className="w-full bg-[#253344] border border-[#2f4053] rounded-xl px-4 py-3 text-white placeholder-[#4a6278] focus:outline-none focus:border-[#2ea6ff] focus:ring-1 focus:ring-[#2ea6ff] transition-all"
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-[#708fa0] text-xs font-medium mb-2 uppercase tracking-wider">
                  Фамилия (необязательно)
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
                  placeholder="Ваша фамилия"
                  className="w-full bg-[#253344] border border-[#2f4053] rounded-xl px-4 py-3 text-white placeholder-[#4a6278] focus:outline-none focus:border-[#2ea6ff] focus:ring-1 focus:ring-[#2ea6ff] transition-all"
                />
              </div>
              {error && (
                <p className="text-[#ff6b6b] text-sm mb-4 flex items-center gap-1">
                  <span>⚠️</span> {error}
                </p>
              )}
              <button
                onClick={handleSaveProfile}
                disabled={loading || !firstName.trim()}
                className="w-full bg-[#2ea6ff] hover:bg-[#1a8de0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all text-base"
              >
                {loading ? "Сохранение..." : "Начать использовать Epicgram"}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-[#4a6278] text-xs mt-6">
          Используя Epicgram, вы соглашаетесь с условиями использования
        </p>
      </div>
    </div>
  );
}
