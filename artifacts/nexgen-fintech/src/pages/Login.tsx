import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowRight, UserPlus, LogIn, Eye, EyeOff } from "lucide-react";

type Tab = "login" | "register";

export default function Login() {
  const [tab, setTab] = useState<Tab>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [loginForm, setLoginForm] = useState({ mobile: "", password: "" });
  const [regForm, setRegForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    pan: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Login failed", description: data.error, variant: "destructive" });
        return;
      }
      loginUser(data.user);
      toast({ title: "Welcome back!", description: `Hello, ${data.user.firstName}` });
      navigate("/dashboard");
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (regForm.password !== regForm.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (regForm.password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword, ...body } = regForm;
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...body, pan: body.pan.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Registration failed", description: data.error, variant: "destructive" });
        return;
      }
      loginUser(data.user);
      toast({ title: "Account created!", description: `Welcome, ${data.user.firstName}!` });
      navigate("/dashboard");
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center justify-center gap-2">
            {/* K-flow mark */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <rect width="32" height="32" rx="7" fill="#0F172A"/>
              <line x1="9" y1="7" x2="9" y2="25" stroke="white" strokeWidth="2.8" strokeLinecap="round"/>
              <line x1="9" y1="16" x2="20" y2="7" stroke="white" strokeWidth="2.8" strokeLinecap="round"/>
              <line x1="9" y1="16" x2="22" y2="25" stroke="url(#lkf)" strokeWidth="2.8" strokeLinecap="round"/>
              <line x1="17" y1="24" x2="24" y2="27" stroke="#00D2FF" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
              <defs>
                <linearGradient id="lkf" x1="9" y1="16" x2="22" y2="25" gradientUnits="userSpaceOnUse">
                  <stop stopColor="white"/>
                  <stop offset="1" stopColor="#00D2FF"/>
                </linearGradient>
              </defs>
            </svg>
            <span>Kredi</span><span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">flo</span>
          </h1>
          <p className="text-muted-foreground mt-2">Seamless Data. Effortless Credit.</p>
        </div>

        <Card className="border-border/60 shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex rounded-xl bg-muted p-1 gap-1">
              {(["login", "register"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-all duration-200 ${
                    tab === t
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "login" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {t === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent>
            <AnimatePresence mode="wait">
              {tab === "login" ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="mobile">Mobile Number</Label>
                    <Input
                      id="mobile"
                      type="tel"
                      placeholder="9876543210"
                      value={loginForm.mobile}
                      onChange={(e) => setLoginForm((p) => ({ ...p, mobile: e.target.value }))}
                      required
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                        required
                        className="h-11 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                    Sign In
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Admin?{" "}
                    <a href="/admin/login" className="text-primary hover:underline">
                      Admin portal →
                    </a>
                  </p>
                </motion.form>
              ) : (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleRegister}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>First Name</Label>
                      <Input
                        placeholder="Rahul"
                        value={regForm.firstName}
                        onChange={(e) => setRegForm((p) => ({ ...p, firstName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last Name</Label>
                      <Input
                        placeholder="Sharma"
                        value={regForm.lastName}
                        onChange={(e) => setRegForm((p) => ({ ...p, lastName: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mobile Number</Label>
                    <Input
                      type="tel"
                      placeholder="9876543210"
                      value={regForm.mobile}
                      onChange={(e) => setRegForm((p) => ({ ...p, mobile: e.target.value }))}
                      required
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>PAN Number</Label>
                    <Input
                      placeholder="ABCDE1234F"
                      value={regForm.pan}
                      onChange={(e) => setRegForm((p) => ({ ...p, pan: e.target.value.toUpperCase() }))}
                      required
                      maxLength={10}
                      className="font-mono tracking-wider"
                    />
                    <p className="text-xs text-muted-foreground">Format: ABCDE1234F</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Address</Label>
                    <Input
                      placeholder="123, MG Road, Mumbai"
                      value={regForm.address}
                      onChange={(e) => setRegForm((p) => ({ ...p, address: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 8 characters"
                        value={regForm.password}
                        onChange={(e) => setRegForm((p) => ({ ...p, password: e.target.value }))}
                        required
                        className="h-11 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirm Password</Label>
                    <Input
                      type="password"
                      placeholder="Re-enter password"
                      value={regForm.confirmPassword}
                      onChange={(e) => setRegForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    Create Account
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
