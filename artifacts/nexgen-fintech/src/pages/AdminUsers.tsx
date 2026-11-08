import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Users, Search, Trash2, KeyRound, Pencil, ChevronDown, ChevronRight,
  UserCheck, UserX, Download, FileText, Eye, X, Check, AlertTriangle, ShieldCheck,
  UserPlus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { maskPan, maskAadhaar } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

type User = {
  id: number;
  firstName: string;
  lastName: string;
  mobile: string;
  pan: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  loanCount: number;
};

type AdminAccount = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
};

type AccountType = "customer" | "admin";

function CreateAccountDialog({
  open,
  initialType,
  onClose,
}: {
  open: boolean;
  initialType: AccountType;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [accountType, setAccountType] = useState<AccountType>("customer");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    pan: "",
    address: "",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (open) {
      setAccountType(initialType);
      setForm({
        firstName: "", lastName: "", mobile: "", pan: "", address: "",
        name: "", email: "", password: "", confirmPassword: "",
      });
    }
  }, [initialType, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const isAdmin = accountType === "admin";
      const path = isAdmin ? "/api/admin/admins" : "/api/admin/users";
      const body = isAdmin
        ? { name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password }
        : {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            mobile: form.mobile,
            pan: form.pan.trim().toUpperCase(),
            address: form.address.trim() || undefined,
            password: form.password,
          };
      return apiFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-admins"] });
      toast({
        title: accountType === "admin" ? "Administrator created" : "Customer account created",
        description: accountType === "admin"
          ? "The new administrator can sign in immediately."
          : "The new customer can sign in with their mobile number.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Could not create account", description: error.message, variant: "destructive" });
    },
  });

  const close = () => {
    if (!mutation.isPending) onClose();
  };
  const mismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;
  const isAdmin = accountType === "admin";
  const canSubmit = form.password.length >= 8
    && form.password === form.confirmPassword
    && (isAdmin
      ? form.name.trim().length > 0 && form.email.trim().length > 0
      : form.firstName.trim().length > 0
        && form.lastName.trim().length > 0
        && form.mobile.length === 10
        && form.pan.length === 10);

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-cyan-600" /> Create Account
          </DialogTitle>
          <DialogDescription>
            Create a ready-to-use customer or administrator account. Passwords are securely encrypted before storage.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="account-type">Account Type</Label>
            <select
              id="account-type"
              className="h-11 px-3 rounded-md border border-input bg-background text-sm"
              value={accountType}
              onChange={(event) => setAccountType(event.target.value as AccountType)}
              disabled={mutation.isPending}
            >
              <option value="customer">Customer</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {isAdmin ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="admin-name">Full Name</Label>
                <Input
                  id="admin-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Operations Manager"
                  required
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="admin-email">Email Address</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="manager@example.com"
                  required
                  disabled={mutation.isPending}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="customer-first-name">First Name</Label>
                  <Input
                    id="customer-first-name"
                    value={form.firstName}
                    onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                    placeholder="Rahul"
                    required
                    disabled={mutation.isPending}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="customer-last-name">Last Name</Label>
                  <Input
                    id="customer-last-name"
                    value={form.lastName}
                    onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                    placeholder="Sharma"
                    required
                    disabled={mutation.isPending}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="customer-mobile">Mobile Number</Label>
                <Input
                  id="customer-mobile"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.mobile}
                  onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value.replace(/\D/g, "") }))}
                  placeholder="9876543210"
                  required
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="customer-pan">PAN Number</Label>
                <Input
                  id="customer-pan"
                  maxLength={10}
                  value={form.pan}
                  onChange={(event) => setForm((current) => ({ ...current, pan: event.target.value.toUpperCase() }))}
                  placeholder="ABCDE1234F"
                  className="font-mono tracking-wider"
                  required
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="customer-address">Address <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="customer-address"
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  placeholder="123, MG Road, Mumbai"
                  disabled={mutation.isPending}
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="created-password">Password</Label>
              <Input
                id="created-password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Min. 8 characters"
                minLength={8}
                required
                disabled={mutation.isPending}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="created-confirm-password">Confirm Password</Label>
              <Input
                id="created-confirm-password"
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                placeholder="Re-enter password"
                className={mismatch ? "border-red-400" : ""}
                required
                disabled={mutation.isPending}
              />
            </div>
          </div>
          {mismatch && <p className="text-xs text-red-500">Passwords do not match.</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? "Creating…" : `Create ${isAdmin ? "Administrator" : "Customer"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserRow({ user, onEdit, onDelete, onResetPwd, onViewSheet }: {
  user: User;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
  onResetPwd: (u: User) => void;
  onViewSheet: (u: User) => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="border-b border-border last:border-0"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${user.isActive ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div>
            <p className="font-medium text-sm text-slate-900 dark:text-white">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-muted-foreground">{user.mobile}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-sm font-mono text-muted-foreground">{user.pan}</td>
      <td className="py-3 px-4">
        <Badge variant={user.isActive ? "default" : "secondary"} className={user.isActive ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 hover:bg-cyan-100" : ""}>
          {user.isActive ? <><UserCheck className="w-3 h-3 mr-1" />Active</> : <><UserX className="w-3 h-3 mr-1" />Inactive</>}
        </Badge>
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground">{user.loanCount}</td>
      <td className="py-3 px-4 text-sm text-muted-foreground">{format(new Date(user.createdAt), "dd MMM yyyy")}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="w-7 h-7" title="Edit user" onClick={() => onEdit(user)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="w-7 h-7" title="Reset password" onClick={() => onResetPwd(user)}>
            <KeyRound className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="w-7 h-7" title="View detail sheet" onClick={() => onViewSheet(user)}>
            <FileText className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="w-7 h-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete user" onClick={() => onDelete(user)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </motion.tr>
  );
}

function EditUserDialog({ user, open, onClose }: { user: User | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<User>>({});

  const mutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/api/admin/users/${user!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User updated successfully" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;

  const f = (field: keyof User) => (form[field] !== undefined ? form[field] : user[field]) as string;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit User</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {[
            { label: "First Name", key: "firstName" },
            { label: "Last Name", key: "lastName" },
            { label: "Mobile", key: "mobile" },
            { label: "PAN", key: "pan" },
            { label: "Address", key: "address" },
          ].map(({ label, key }) => (
            <div key={key} className="grid gap-1.5">
              <Label className="text-xs">{label}</Label>
              <Input
                value={f(key as keyof User) ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                className="h-9"
              />
            </div>
          ))}
          <div className="grid gap-1.5">
            <Label className="text-xs">Status</Label>
            <select
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
              value={form.isActive !== undefined ? String(form.isActive) : String(user.isActive)}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === "true" }))}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ ...form, pan: (form.pan ?? user.pan)?.toUpperCase() })}
          >
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, open, onClose }: { user: User | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: () => apiFetch(`/api/admin/users/${user!.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: pwd }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Password reset successfully" });
      setPwd(""); setConfirm("");
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;
  const mismatch = confirm.length > 0 && pwd !== confirm;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPwd(""); setConfirm(""); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" /> Reset Password</DialogTitle>
          <DialogDescription>Set a new password for {user.firstName} {user.lastName}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">New Password</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Min. 8 characters" className="h-9" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Confirm Password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" className={`h-9 ${mismatch ? "border-red-400" : ""}`} />
            {mismatch && <p className="text-xs text-red-500">Passwords do not match</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setPwd(""); setConfirm(""); onClose(); }}>Cancel</Button>
          <Button
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
            disabled={mutation.isPending || pwd.length < 8 || pwd !== confirm}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Resetting…" : "Reset Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({ user, open, onClose }: { user: User | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => apiFetch(`/api/admin/users/${user!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User deleted" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-4 h-4" /> Delete User</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{user.firstName} {user.lastName}</strong> and all their loan applications. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Deleting…" : "Delete User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailSheetModal({ user, open, onClose }: { user: User | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-sheet", user?.id],
    queryFn: () => apiFetch(`/api/admin/users/${user!.id}/detail-sheet`),
    enabled: open && !!user,
  });

  const handleDownload = () => {
    window.open(`${BASE}/api/admin/users/${user!.id}/detail-sheet/download`, "_blank");
  };

  if (!user) return null;

  const d: any = data?.data ?? {};
  const hasData = data?.data !== null && Object.keys(d).length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-600" />
              Detail Sheet — {user.firstName} {user.lastName}
            </DialogTitle>
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5" /> Download Excel
            </Button>
          </div>
          {data?.updatedAt && (
            <p className="text-xs text-muted-foreground">Last updated: {format(new Date(data.updatedAt), "dd MMM yyyy, h:mm a")}</p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !hasData ? (
          <div className="py-8 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">This user has not submitted a detail sheet yet.</p>
          </div>
        ) : (
          <div className="space-y-5 py-2 text-sm">
            <SheetSection title="Individual Details" rows={[
              ["Name", d.individual?.name], ["Mobile", d.individual?.mobile], ["Email", d.individual?.email],
              ["PAN", maskPan(d.individual?.pan)], ["Aadhar", maskAadhaar(d.individual?.aadhar)], ["DOB", d.individual?.dob],
              ["Father's Name", d.individual?.fatherName], ["Mother's Name", d.individual?.motherName],
              ["Spouse Name", d.individual?.spouseName], ["Qualification", d.individual?.qualification],
              ["Current Address", d.individual?.currentAddress], ["Address Proof", d.individual?.addressProof],
              ["Residence Status", d.individual?.residenceStatus], ["Residence Since", d.individual?.residenceSince],
            ]} />
            <SheetSection title="Co-Applicant Details" rows={[
              ["Name", d.coApplicant?.name], ["Mobile", d.coApplicant?.mobile], ["Email", d.coApplicant?.email],
              ["PAN", maskPan(d.coApplicant?.pan)], ["Aadhar", maskAadhaar(d.coApplicant?.aadhar)], ["DOB", d.coApplicant?.dob],
              ["Father's Name", d.coApplicant?.fatherName], ["Mother's Name", d.coApplicant?.motherName],
              ["Residence Status", d.coApplicant?.residenceStatus],
            ]} />
            <SheetSection title="Company Details" rows={[
              ["Company Name", d.company?.name], ["Incorporation Date", d.company?.incorporationDate],
              ["Office Address", d.company?.officeAddress], ["Office Status", d.company?.officeStatus],
              ["GST No.", d.company?.gstNumber], ["PAN", maskPan(d.company?.pan)],
              ["Nature of Business", d.company?.natureOfBusiness], ["Address Proof", d.company?.addressProof],
            ]} />
            {(d.personalRef1?.name || d.personalRef2?.name) && (
              <div>
                <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Personal References</h3>
                <div className="grid grid-cols-2 gap-4">
                  <SheetSection title="Reference 1" rows={[["Name", d.personalRef1?.name], ["Mobile", d.personalRef1?.mobile], ["Address", d.personalRef1?.address]]} />
                  <SheetSection title="Reference 2" rows={[["Name", d.personalRef2?.name], ["Mobile", d.personalRef2?.mobile], ["Address", d.personalRef2?.address]]} />
                </div>
              </div>
            )}
            {(d.tradeRef1?.companyName || d.tradeRef2?.companyName) && (
              <div>
                <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Trade References</h3>
                <div className="grid grid-cols-2 gap-4">
                  <SheetSection title="Trade Ref 1" rows={[["Company", d.tradeRef1?.companyName], ["Contact", d.tradeRef1?.contactPerson], ["Mobile", d.tradeRef1?.mobile], ["Address", d.tradeRef1?.address]]} />
                  <SheetSection title="Trade Ref 2" rows={[["Company", d.tradeRef2?.companyName], ["Contact", d.tradeRef2?.contactPerson], ["Mobile", d.tradeRef2?.mobile], ["Address", d.tradeRef2?.address]]} />
                </div>
              </div>
            )}
            {(d.existingLoans ?? []).length > 0 && (
              <div>
                <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Existing Loans</h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 dark:bg-slate-800/50">{["Bank", "Amount", "Type", "Start", "End", "Balance"].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>)}</tr></thead>
                    <tbody>{(d.existingLoans as any[]).map((l, i) => (
                      <tr key={i} className="border-t border-border"><td className="px-3 py-2">{l.bankName}</td><td className="px-3 py-2">{l.loanAmount}</td><td className="px-3 py-2">{l.loanType}</td><td className="px-3 py-2">{l.startDate}</td><td className="px-3 py-2">{l.endDate}</td><td className="px-3 py-2">{l.currentBalance}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SheetSection({ title, rows }: { title: string; rows: [string, string | undefined][] }) {
  const visible = rows.filter(([, v]) => v);
  if (!visible.length) return null;
  return (
    <div>
      <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2 border-b border-border pb-1">{title}</h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {visible.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium break-all">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [createAccountType, setCreateAccountType] = useState<AccountType>("customer");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [sheetUser, setSheetUser] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/api/admin/users"),
  });
  const { data: admins = [], isLoading: isLoadingAdmins } = useQuery<AdminAccount[]>({
    queryKey: ["admin-admins"],
    queryFn: () => apiFetch("/api/admin/admins"),
  });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.mobile.includes(q) ||
      u.pan.toLowerCase().includes(q)
    );
  });

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <Users className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
              <p className="text-sm text-muted-foreground">{users.length} registered user{users.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2"
              onClick={() => {
                setCreateAccountType("customer");
                setCreateAccountOpen(true);
              }}
            >
              <UserPlus className="w-4 h-4" /> Create Account
            </Button>
            <Link href="/admin">
              <Button variant="outline" size="sm">← Dashboard</Button>
            </Link>
          </div>
        </div>

        <Card className="border border-border">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <CardTitle className="text-base">All Users</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, mobile, PAN…"
                  className="pl-9 h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{search ? "No users match your search" : "No registered users yet"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-800/30">
                      {["User", "PAN", "Status", "Applications", "Joined", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filtered.map((u) => (
                        <UserRow
                          key={u.id}
                          user={u}
                          onEdit={setEditUser}
                          onDelete={setDeleteUser}
                          onResetPwd={setResetUser}
                          onViewSheet={setSheetUser}
                        />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-600" /> Administrators
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {admins.length} administrator{admins.length !== 1 ? "s" : ""} can access the admin portal
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setCreateAccountType("admin");
                  setCreateAccountOpen(true);
                }}
              >
                <UserPlus className="w-3.5 h-3.5" /> Add Admin
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingAdmins ? (
              <div className="space-y-3 p-6">{[1, 2].map((item) => <Skeleton key={item} className="h-10 w-full" />)}</div>
            ) : admins.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No administrator accounts found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-800/30">
                      {["Administrator", "Email", "Created"].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr key={admin.id} className="border-b border-border last:border-0">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                              {admin.name.slice(0, 1).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm text-slate-900 dark:text-white">{admin.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{admin.email}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{format(new Date(admin.createdAt), "dd MMM yyyy")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <CreateAccountDialog
        open={createAccountOpen}
        initialType={createAccountType}
        onClose={() => setCreateAccountOpen(false)}
      />
      <EditUserDialog user={editUser} open={!!editUser} onClose={() => setEditUser(null)} />
      <ResetPasswordDialog user={resetUser} open={!!resetUser} onClose={() => setResetUser(null)} />
      <DeleteConfirmDialog user={deleteUser} open={!!deleteUser} onClose={() => setDeleteUser(null)} />
      <DetailSheetModal user={sheetUser} open={!!sheetUser} onClose={() => setSheetUser(null)} />
    </div>
  );
}
