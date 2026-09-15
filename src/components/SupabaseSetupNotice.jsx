export default function SupabaseSetupNotice() {
  return (
    <main dir="rtl" className="min-h-screen bg-stone-50 px-5 py-12 text-slate-900 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-7 shadow-xl shadow-stone-900/5 sm:p-10">
        <p className="mb-3 text-sm font-semibold text-teal-700">Iran Trip Advisor</p>
        <h1 className="font-heading text-3xl font-bold leading-relaxed">تنظیمات محلی Supabase وارد نشده است</h1>
        <p className="mt-4 font-body leading-8 text-slate-600">
          برای اجرای برنامه روی کامپیوتر خودتان، فایل <code dir="ltr" className="rounded bg-stone-100 px-1.5 py-0.5 text-sm">.env</code> را بسازید و آدرس پروژه و کلید عمومی Supabase را در آن وارد کنید.
        </p>
        <ol className="mt-6 list-decimal space-y-3 ps-6 font-body leading-7 text-slate-700">
          <li>فایل <code dir="ltr" className="rounded bg-stone-100 px-1.5 py-0.5 text-sm">.env.example</code> را با نام <code dir="ltr" className="rounded bg-stone-100 px-1.5 py-0.5 text-sm">.env</code> کپی کنید.</li>
          <li>در Supabase، از مسیر <span dir="ltr">Project Settings → API</span>، مقدارهای <span dir="ltr">Project URL</span> و <span dir="ltr">Publishable key</span> را وارد کنید.</li>
          <li>سرور توسعه را یک‌بار متوقف و دوباره اجرا کنید.</li>
        </ol>
        <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">
          کلید <span dir="ltr">service_role</span> را هرگز در فایل <span dir="ltr">.env</span> یا کد مرورگر قرار ندهید.
        </p>
      </section>
    </main>
  );
}
