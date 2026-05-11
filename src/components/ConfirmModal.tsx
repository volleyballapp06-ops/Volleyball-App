import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from './ui/button';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  requiredPassword?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  requiredPassword,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  const [passwordInput, setPasswordInput] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) setPasswordInput('');
  }, [isOpen]);

  const isConfirmDisabled = requiredPassword && passwordInput !== requiredPassword;
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
          <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 sm:p-8 pointer-events-auto border border-slate-100"
            >
              <div className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
                  variant === 'destructive' ? 'bg-red-50 text-red-500' : 'bg-primary/10 text-primary'
                }`}>
                  <AlertCircle className="w-8 h-8" />
                </div>
                
                <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">
                  {title}
                </h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">
                  {description}
                </p>

                {requiredPassword && (
                  <div className="w-full mb-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 text-left">Confirm Password</p>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter security key..."
                      className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
                    />
                  </div>
                )}

                <div className="flex flex-col w-full gap-3">
                  <Button
                    onClick={onConfirm}
                    disabled={isConfirmDisabled}
                    variant={variant === 'destructive' ? 'destructive' : 'default'}
                    className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg disabled:opacity-50"
                  >
                    {confirmText}
                  </Button>
                  <Button
                    onClick={onCancel}
                    variant="ghost"
                    className="w-full h-12 rounded-xl font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest text-[10px]"
                  >
                    {cancelText}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
