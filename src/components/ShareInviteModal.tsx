'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ShareInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: () => void;
  onSkip: () => void;
}

export function ShareInviteModal({ isOpen, onClose, onShare, onSkip }: ShareInviteModalProps) {
  const handleShare = () => {
    onShare();
    onClose();
  };

  const handleSkip = () => {
    onSkip();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleSkip}
        >
          <motion.div
            className="bg-gradient-to-br from-game-dark to-gray-900 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-white/10"
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with animated dots */}
            <div className="text-center mb-6">
              <div className="flex justify-center gap-2 mb-4">
                {['#FF6B6B', '#F7DC6F', '#4ECDC4', '#BB8FCE'].map((color, i) => (
                  <motion.div
                    key={i}
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.7, 1, 0.7],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Invite Friends
              </h2>
              <p className="text-gray-400 text-sm">
                Share Pizza Dots with your friends and grow the community!
              </p>
            </div>

            {/* Message preview */}
            <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
              <p className="text-white text-center font-medium">
                Connect the dots. Capture the slices. Win $PIZZA!
              </p>
            </div>

            {/* Stats teaser */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                { icon: '🎲', label: 'Roll Dice' },
                { icon: '🔴', label: 'Connect' },
                { icon: '🍕', label: 'Win Pizza' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="text-center p-2 rounded-lg bg-white/5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <p className="text-xs text-gray-400">{item.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <motion.button
                onClick={handleShare}
                className="w-full py-4 rounded-xl font-bold text-lg text-white"
                style={{
                  background: 'linear-gradient(135deg, #FF6B6B, #F7DC6F, #4ECDC4)',
                  boxShadow: '0 0 20px rgba(247, 220, 111, 0.3)',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Share with Friends
              </motion.button>

              <button
                onClick={handleSkip}
                className="w-full py-3 text-gray-400 hover:text-white transition-colors text-sm"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
