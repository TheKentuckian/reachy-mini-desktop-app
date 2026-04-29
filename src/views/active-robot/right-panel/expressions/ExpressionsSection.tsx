import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { EmotionWheel, EmojiPicker } from '@components/emoji-grid';
import type { EmotionWheelHandle } from '@components/emoji-grid/EmotionWheel';
import { ACCENT, accentAlpha } from '@styles/tokens';
import { DURATION, FONT_WEIGHT, TYPO, transition, useAppPalette } from '@styles';
import {
  CHOREOGRAPHY_DATASETS,
  EMOTION_EFFECT_DURATION_MS,
  EMOTION_EFFECT_MAP,
  EMOTIONS,
  DANCES,
  type EmojiGridAction,
} from '@constants/choreographies';
import { useRobotCommands } from '@hooks/robot';
import { useActiveRobotContext } from '../../context';
import { useLogger } from '@/utils/logging';
import { telemetry } from '@/utils/telemetry';

/** Debounce the `isBusy` flag to avoid UI flicker between transient states. */
const BUSY_DEBOUNCE_MS = 150;

/** Debounce clearing the active action so the spinner doesn't flash between
 *  the "command running" and "moving" busy reasons. */
const ACTIVE_ACTION_RESET_DEBOUNCE_MS = 100;

/** Maximum time an emotion spinner stays visible. Guards against the daemon
 *  failing to report completion (e.g. stale WebSocket on Crostini/Linux). */
const ACTIVE_ACTION_MAX_DISPLAY_MS = 45_000;

type View = 'wheel' | 'library';
type TimeoutId = ReturnType<typeof setTimeout>;

export interface ExpressionsSectionProps {
  isBusy?: boolean;
  /** @deprecated No longer used; theme is read from the global store. */
  darkMode?: boolean;
}

/**
 * Expressions Section - Emotion Wheel + Library view.
 * Displays either a curated wheel of emotions or the full library grid.
 */
export default function ExpressionsSection({
  isBusy: _isBusyProp = false,
}: ExpressionsSectionProps): React.ReactElement {
  const palette = useAppPalette();
  const [currentView, setCurrentView] = useState<View>('library');
  const [spacePressed, setSpacePressed] = useState<boolean>(false);
  const wheelRef = useRef<EmotionWheelHandle | null>(null);

  const { robotState, actions } = useActiveRobotContext();
  const { robotStatus, isCommandRunning, isAppRunning, isInstalling, busyReason } = robotState;
  const { setRightPanelView, triggerEffect, stopEffect } = actions;

  const isReady = robotStatus === 'ready';
  const isExecuting = isCommandRunning || busyReason === 'moving';

  const [activeActionName, setActiveActionName] = useState<string | null>(null);
  const activeActionResetTimeoutRef = useRef<TimeoutId | null>(null);
  const activeActionMaxTimeoutRef = useRef<TimeoutId | null>(null);

  const rawIsBusy = robotStatus === 'busy' || isCommandRunning || isAppRunning || isInstalling;
  const [debouncedIsBusy, setDebouncedIsBusy] = useState<boolean>(rawIsBusy);
  const debounceTimeoutRef = useRef<TimeoutId | null>(null);

  const { playRecordedMove } = useRobotCommands();
  const logger = useLogger();

  const effectTimeoutRef = useRef<TimeoutId | null>(null);

  // Space key triggers a random emotion spin while on the wheel view.
  useEffect(() => {
    if (currentView !== 'wheel') return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpacePressed(true);
        wheelRef.current?.triggerRandom?.();
      }
    };
    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') setSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentView]);

  // Debounce isBusy to smooth out transient state changes.
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (rawIsBusy && !debouncedIsBusy) {
      setDebouncedIsBusy(true);
    } else if (!rawIsBusy && debouncedIsBusy) {
      debounceTimeoutRef.current = setTimeout(() => {
        setDebouncedIsBusy(false);
      }, BUSY_DEBOUNCE_MS);
    }

    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [rawIsBusy, debouncedIsBusy]);

  const handleAction = useCallback(
    (action: EmojiGridAction): void => {
      // Ignore taps while the robot is busy. This guard used to live in a
      // dedicated `handleWheelAction` wrapper - it's simpler here.
      if (debouncedIsBusy) return;

      setActiveActionName(action.name);

      // Safety net: force-clear the spinner after ACTIVE_ACTION_MAX_DISPLAY_MS
      // in case the daemon never reports completion (stale WebSocket, etc.).
      if (activeActionMaxTimeoutRef.current) clearTimeout(activeActionMaxTimeoutRef.current);
      activeActionMaxTimeoutRef.current = setTimeout(() => {
        activeActionMaxTimeoutRef.current = null;
        setActiveActionName(null);
      }, ACTIVE_ACTION_MAX_DISPLAY_MS);

      const prefix = action.type === 'dance' ? 'Playing dance' : 'Playing emotion';
      logger.userAction(`${prefix}: ${action.label}`);
      telemetry.expressionPlayed({ name: action.name, type: action.type });

      const dataset =
        action.type === 'dance' ? CHOREOGRAPHY_DATASETS.DANCES : CHOREOGRAPHY_DATASETS.EMOTIONS;
      playRecordedMove(dataset, action.name);

      const effectType = EMOTION_EFFECT_MAP[action.name];
      if (effectType) {
        triggerEffect(effectType);
        if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
        effectTimeoutRef.current = setTimeout(() => {
          stopEffect();
          effectTimeoutRef.current = null;
        }, EMOTION_EFFECT_DURATION_MS);
      }
    },
    [debouncedIsBusy, playRecordedMove, triggerEffect, stopEffect, logger]
  );

  // Flush the effect and max-display timeouts on unmount.
  useEffect(() => {
    return () => {
      if (effectTimeoutRef.current) {
        clearTimeout(effectTimeoutRef.current);
        effectTimeoutRef.current = null;
      }
      if (activeActionMaxTimeoutRef.current) {
        clearTimeout(activeActionMaxTimeoutRef.current);
        activeActionMaxTimeoutRef.current = null;
      }
    };
  }, []);

  // Reset the active action once the robot leaves all busy reasons.
  useEffect(() => {
    if (activeActionResetTimeoutRef.current) {
      clearTimeout(activeActionResetTimeoutRef.current);
      activeActionResetTimeoutRef.current = null;
    }

    if (!isExecuting && activeActionName) {
      activeActionResetTimeoutRef.current = setTimeout(() => {
        setActiveActionName(null);
      }, ACTIVE_ACTION_RESET_DEBOUNCE_MS);
    }

    return () => {
      if (activeActionResetTimeoutRef.current) {
        clearTimeout(activeActionResetTimeoutRef.current);
      }
    };
  }, [isExecuting, activeActionName]);

  const handleBack = useCallback((): void => {
    if (isExecuting) return;
    if (currentView === 'wheel') {
      setCurrentView('library');
    } else {
      setRightPanelView(null);
    }
  }, [isExecuting, currentView, setRightPanelView]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'transparent',
        position: 'relative',
      }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 1, bgcolor: 'transparent' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={handleBack}
            size="small"
            disabled={isExecuting}
            sx={{
              color: isExecuting ? palette.textFaint : ACCENT.main,
              cursor: isExecuting ? 'not-allowed' : 'pointer',
              '&:hover': {
                bgcolor: isExecuting
                  ? 'transparent'
                  : palette.isDark
                    ? accentAlpha(0.1)
                    : accentAlpha(0.05),
              },
              '&.Mui-disabled': {
                color: palette.textFaint,
              },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: TYPO.xxl }} />
          </IconButton>
          <Typography
            sx={{
              fontSize: TYPO.xxl,
              fontWeight: FONT_WEIGHT.bold,
              color: palette.textPrimary,
              letterSpacing: '-0.3px',
            }}
          >
            {currentView === 'wheel' ? 'Emotion Wheel' : 'Expressions'}
          </Typography>
        </Box>
      </Box>

      {currentView === 'wheel' ? (
        <>
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 2,
              pb: 6,
            }}
          >
            <EmotionWheel
              ref={wheelRef}
              onAction={handleAction}
              disabled={debouncedIsBusy || !isReady}
              isBusy={debouncedIsBusy}
              activeActionName={activeActionName}
              isExecuting={isExecuting}
            />
          </Box>

          <Box
            sx={{
              position: 'absolute',
              bottom: 24,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                color: palette.textFaint,
                fontSize: TYPO.xs,
              }}
            >
              <Box
                component="span"
                sx={{
                  px: 1.5,
                  py: 0.25,
                  borderRadius: 1,
                  border: spacePressed ? `1px solid ${ACCENT.main}` : `1px solid ${palette.border}`,
                  bgcolor: spacePressed ? accentAlpha(0.15) : 'transparent',
                  color: spacePressed ? ACCENT.main : 'inherit',
                  fontFamily: 'monospace',
                  fontSize: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  transition: transition('all', DURATION.fast),
                  transform: spacePressed ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                Space
              </Box>
              <span>random</span>
            </Box>
          </Box>
        </>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2, pb: 2 }}>
          <EmojiPicker
            emotions={EMOTIONS}
            dances={DANCES}
            onAction={handleAction}
            disabled={debouncedIsBusy || !isReady}
            activeActionName={activeActionName}
            isExecuting={isExecuting}
          />
        </Box>
      )}
    </Box>
  );
}
