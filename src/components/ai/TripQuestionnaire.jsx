import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { localize, localizeTripOption } from '@/lib/localize';

export default function TripQuestionnaire({
  currentQuestion,
  questions,
  tripData,
  onAnswerChange,
  onNext,
  onPrev,
  lang
}) {
  const question = questions[currentQuestion];
  const answer = tripData[question.id];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && answer) {
      onNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl mx-auto"
    >
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">
            {localize(lang, `Question ${currentQuestion + 1} of ${questions.length}`, `پرسش ${currentQuestion + 1} از ${questions.length}`, `السؤال ${currentQuestion + 1} من ${questions.length}`)}
          </span>
          <span className="text-sm font-medium text-teal-600">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-teal-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 leading-tight">
          {typeof question.question === 'function' ? question.question(lang) : question.question}
        </h2>

        {/* Answer Input */}
        {question.type === 'text' || question.type === 'number' ? (
          <input
            type={question.type}
            value={answer}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={typeof question.placeholder === 'function' ? question.placeholder(lang) : question.placeholder}
            className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 transition text-lg"
            autoFocus
          />
        ) : question.type === 'select' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question.options.map((option) => (
              <button
                key={option}
                onClick={() => onAnswerChange(question.id, option)}
                className={`p-4 rounded-xl border-2 font-medium transition text-left ${
                  answer === option
                    ? 'border-teal-500 bg-teal-50 text-teal-900'
                    : 'border-slate-300 bg-white text-slate-900 hover:border-teal-300'
                }`}
              >
                {localizeTripOption(option, lang)}
              </button>
            ))}
          </div>
        ) : null}

        {question.required && !answer && (
          <p className="text-red-500 text-sm mt-2">
            {localize(lang, 'This question is required', 'پاسخ به این پرسش ضروری است.', 'الإجابة عن هذا السؤال مطلوبة.')}
          </p>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onPrev}
          disabled={currentQuestion === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-900 font-medium hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-5 h-5" />
          {localize(lang, 'Back', 'قبلی', 'السابق')}
        </button>

        <button
          onClick={onNext}
          disabled={question.required && !answer}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-500 text-white font-medium hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {currentQuestion === questions.length - 1 ? (
            <>
              {localize(lang, 'Preview', 'پیش‌نمایش', 'معاينة')}
            </>
          ) : (
            <>
              {localize(lang, 'Next', 'بعدی', 'التالي')}
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
