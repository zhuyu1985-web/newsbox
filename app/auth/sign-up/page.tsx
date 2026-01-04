import { SignUpForm } from "@/components/sign-up-form";

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10 overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/10 blur-[100px] rounded-full -z-10" />
      
      <div className="w-full max-w-sm relative z-10">
        <SignUpForm />
      </div>
    </div>
  );
}
