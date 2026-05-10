import { Droplets } from "lucide-react";

const IS_DEV = import.meta.env.DEV;

export default function SignIn() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[hsl(20_14%_7%)]">
      {/* Glow bg */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-orange-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
            <Droplets className="w-8 h-8 text-orange-500" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Tank Monitor</h1>
            <p className="text-sm text-[hsl(24_8%_55%)] mt-1">by Firesky Industries</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[hsl(20_12%_10%)] border border-[hsl(24_10%_18%)] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-1">Sign in to your portal</h2>
          <p className="text-sm text-[hsl(24_8%_55%)] mb-6">
            Monitor your water tank levels from anywhere.
          </p>

          <a
            href="/api/portal/auth/google"
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-full bg-white text-gray-800 font-medium text-sm hover:bg-gray-100 transition-colors shadow"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          {IS_DEV && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-[hsl(24_10%_18%)]" />
                <span className="text-xs text-[hsl(24_8%_40%)]">dev only</span>
                <div className="flex-1 h-px bg-[hsl(24_10%_18%)]" />
              </div>
              <a
                href="/api/portal/auth/dev-login"
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-full border border-[hsl(24_10%_25%)] text-[hsl(24_8%_65%)] text-sm hover:border-orange-500/40 hover:text-orange-400 transition-colors"
              >
                Dev bypass (no credentials needed)
              </a>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[hsl(24_8%_35%)] mt-6">
          Need a sensor unit? Contact{" "}
          <a href="mailto:info@fireskyindustries.co.za" className="text-orange-500 hover:underline">
            Firesky Industries
          </a>
        </p>
      </div>
    </div>
  );
}
