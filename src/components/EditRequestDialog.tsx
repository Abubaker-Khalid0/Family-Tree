import { useState } from 'react';
import { X, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── رابط Formspree ───
const FORMSPREE_URL = 'https://formspree.io/f/mzdnrkww';

// ─── رقم واتساب (احتياطي — مجمّد حالياً) ───
// const WHATSAPP_NUMBER = '971528986794';

type RequestType = 'add' | 'edit' | 'delete' | 'fix';

const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: 'add', label: 'إضافة شخص' },
  { value: 'edit', label: 'تعديل معلومة' },
  { value: 'delete', label: 'حذف شخص' },
  { value: 'fix', label: 'تصحيح خطأ' },
];

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

interface EditRequestDialogProps {
  open: boolean;
  onClose: () => void;
}

export function EditRequestDialog({ open, onClose }: EditRequestDialogProps) {
  const [name, setName] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('edit');
  const [personName, setPersonName] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<SendStatus>('idle');

  const canSubmit = name.trim() && details.trim() && status !== 'sending';

  const resetForm = () => {
    setName('');
    setRequestType('edit');
    setPersonName('');
    setDetails('');
    setStatus('idle');
  };

  const handleClose = () => {
    if (status !== 'sending') {
      resetForm();
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setStatus('sending');

    const typeLabel = REQUEST_TYPES.find(t => t.value === requestType)?.label || '';

    try {
      const response = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          request_type: typeLabel,
          person_name: personName.trim() || 'غير محدد',
          details: details.trim(),
        }),
      });

      if (response.ok) {
        setStatus('success');
        setTimeout(() => {
          resetForm();
          onClose();
        }, 2000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  // ─── كود واتساب (مجمّد — يمكن تفعيله لاحقاً) ───
  // const handleWhatsApp = () => {
  //   if (!canSubmit) return;
  //   const typeLabel = REQUEST_TYPES.find(t => t.value === requestType)?.label || '';
  //   const message = [
  //     `📋 *طلب تعديل في شجرة العائلة*`,
  //     ``,
  //     `👤 *الاسم:* ${name.trim()}`,
  //     `📌 *نوع الطلب:* ${typeLabel}`,
  //     personName.trim() ? `🔗 *الشخص المعني:* ${personName.trim()}` : '',
  //     ``,
  //     `📝 *التفاصيل:*`,
  //     details.trim(),
  //   ].filter(Boolean).join('\n');
  //   const encoded = encodeURIComponent(message);
  //   window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`, '_blank');
  //   resetForm();
  //   onClose();
  // };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40"
            onClick={handleClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed inset-x-4 top-[10%] z-[101] mx-auto max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:inset-x-auto sm:w-[420px]"
            dir="rtl"
          >
            {/* حالة النجاح */}
            {status === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-8"
              >
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-base font-bold text-gray-900">تم إرسال الطلب بنجاح!</p>
                <p className="text-[13px] text-gray-500">سيتم مراجعة طلبك في أقرب وقت</p>
              </motion.div>
            )}

            {/* حالة الخطأ */}
            {status === 'error' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-6"
              >
                <AlertCircle className="h-12 w-12 text-red-500" />
                <p className="text-base font-bold text-gray-900">فشل إرسال الطلب</p>
                <p className="text-[13px] text-gray-500">تأكد من اتصالك بالإنترنت وحاول مرة أخرى</p>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  حاول مرة أخرى
                </button>
              </motion.div>
            )}

            {/* الفورم */}
            {(status === 'idle' || status === 'sending') && (
              <>
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900">طلب تعديل</h2>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="grid h-8 w-8 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100"
                    aria-label="إغلاق"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Form */}
                <div className="space-y-3">
                  {/* الاسم */}
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-gray-700">
                      اسمك <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="اكتب اسمك هنا"
                      disabled={status === 'sending'}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[13px] outline-none transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                    />
                  </div>

                  {/* نوع الطلب */}
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-gray-700">
                      نوع الطلب
                    </label>
                    <select
                      value={requestType}
                      onChange={(e) => setRequestType(e.target.value as RequestType)}
                      disabled={status === 'sending'}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[13px] outline-none transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                    >
                      {REQUEST_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* الشخص المعني */}
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-gray-700">
                      الشخص المعني <span className="text-[11px] text-gray-400">(اختياري)</span>
                    </label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="اسم الشخص اللي يخصه التعديل"
                      disabled={status === 'sending'}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[13px] outline-none transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                    />
                  </div>

                  {/* التفاصيل */}
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-gray-700">
                      التفاصيل <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="اشرح التعديل المطلوب بالتفصيل..."
                      rows={3}
                      disabled={status === 'sending'}
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-[13px] outline-none transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {status === 'sending' ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        جارٍ الإرسال...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        إرسال الطلب
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={status === 'sending'}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
