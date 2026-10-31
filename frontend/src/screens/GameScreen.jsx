import React, { useEffect, useRef, useState } from 'react';
import { applyActions } from '../api';

export function GameScreen({ emails, classifications, onMissionComplete }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [toasts, setToasts] = useState([]);
  const [cleanedCount, setCleanedCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [importantCount, setImportantCount] = useState(0);
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [processedIndex, setProcessedIndex] = useState(0);
  const [fastForwarding, setFastForwarding] = useState(false);
  const [crouchActive, setCrouchActive] = useState(false);

  // Store actions applied for undo
  const appliedActionsRef = useRef([]);
  const processedEmailsRef = useRef([]);
  const pendingActionsRef = useRef(0);
  const resolvingEmailsRef = useRef(new Set());
  const fastForwardRef = useRef(false);
  const missionCompleteScheduledRef = useRef(false);
  const crouchActionRef = useRef(null);
  const jumpActionRef = useRef(null);

  const handleCrouchChange = (isCrouching) => {
    setCrouchActive(isCrouching);
    crouchActionRef.current?.(isCrouching);
  };
  const handleJump = () => jumpActionRef.current?.();

  // Toast helper
  const addToast = (msg, type = 'archive') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-3), { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2800);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Canvas internal resolution
    canvas.width = 900;
    canvas.height = 380;

    let animationFrameId;
    let lastTime = performance.now();

    // Ground & physics constants
    const groundY = 300;
    const gravity = 1450;
    const jumpVelocity = -520;

    // Robot state
    const robot = {
      x: 90,
      y: groundY - 45,
      width: 40,
      height: 45,
      vy: 0,
      isGrounded: true,
      jumps: 0,
      maxJumps: 2,
      legPhase: 0,
      crouching: false,
    };

    // Obstacles queue generated from emails + classifications
    const emailQueue = emails.map((email, i) => {
      const cls = classifications.find(c => c.id === email.id) || {
        category: 'uncertain',
        priority: 'medium',
        suggested_action: 'needs_review',
      };
      return {
        email,
        classification: cls,
        index: i,
      };
    });

    let currentQueueIdx = 0;
    const activeObstacles = [];
    const particles = [];
    let spawnTimer = 0.5; // initial delay
    const spawnInterval = Math.max(1.8, Math.min(3.2, 50 / emails.length)); // pacing
    let missionFinished = false;
    let scoreValue = 0;
    let heartsValue = 3;

    // Keyboard controls
    const jump = () => {
      if (robot.jumps < robot.maxJumps) {
        robot.vy = jumpVelocity;
        robot.isGrounded = false;
        robot.jumps++;

        for (let i = 0; i < 8; i++) {
          particles.push({
            x: robot.x + 10 + Math.random() * 20,
            y: robot.y + robot.height,
            vx: (Math.random() - 0.5) * 100,
            vy: Math.random() * 150 + 50,
            color: '#d8d8d8',
            size: Math.random() * 4 + 2,
            life: 0.35,
            maxLife: 0.35,
          });
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        handleCrouchChange(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        handleCrouchChange(false);
      }
    };

    const handleWindowBlur = () => handleCrouchChange(false);
    crouchActionRef.current = (isCrouching) => {
      if (isCrouching && !robot.isGrounded) return;
      const feetY = robot.y + robot.height;
      robot.crouching = isCrouching;
      robot.height = isCrouching ? 27 : 45;
      robot.y = feetY - robot.height;
    };
    jumpActionRef.current = jump;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    canvas.addEventListener('pointerdown', jump);

    // Particle burst helper
    function createBurst(x, y, color) {
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 180 + 60;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          size: Math.random() * 4 + 2,
          life: 0.5,
          maxLife: 0.5,
        });
      }
    }

    // Action handler
    async function triggerTriage(obstacle) {
      const email = obstacle.email;
      const cls = obstacle.classification;
      const snippetShort = email.subject.length > 32 ? email.subject.substring(0, 32) + '...' : email.subject;
      const needsReview = cls.category === 'uncertain' || cls.confidence < 0.85 ||
        cls.suggested_action === 'needs_review';
      const chosenAction = needsReview
        ? 'leave_in_inbox'
        : cls.priority === 'high' || cls.category === 'important'
          ? 'flag_important'
          : ['archive', 'label_read_later', 'flag_important', 'leave_in_inbox'].includes(cls.suggested_action)
            ? cls.suggested_action
            : 'leave_in_inbox';

      resolvingEmailsRef.current.add(email.id);
      pendingActionsRef.current++;

      // Apply to backend or fallback state
      let actionStatus = 'rejected';
      let rejectedReason = '';
      try {
        const res = await applyActions([{ email_id: email.id, action: chosenAction }]);
        if (res.applied && res.applied.length > 0) {
          appliedActionsRef.current.push(...res.applied);
          actionStatus = 'applied';
        } else if (res.rejected?.length) {
          rejectedReason = res.rejected[0].reason;
        }
      } catch (err) {
        rejectedReason = err instanceof Error ? err.message : 'Action could not be completed.';
      }

      if (actionStatus === 'applied') {
        if (chosenAction === 'leave_in_inbox') {
          addToast(`${needsReview ? 'For review' : 'Kept safe'}: ${snippetShort}`, needsReview ? 'review' : 'archive');
          if (needsReview) setReviewCount(c => c + 1);
        } else if (chosenAction === 'flag_important') {
          addToast(`Important, kept safe: ${snippetShort}`, 'flag');
        } else if (chosenAction === 'archive') {
          addToast(`Archived: ${snippetShort}`, 'archive');
          setCleanedCount(c => c + 1);
        } else {
          addToast(`Saved for later: ${snippetShort}`, 'archive');
        }
      } else {
        addToast(`Not applied: ${rejectedReason || snippetShort}`, 'review');
      }
      if (cls.category === 'important' || cls.priority === 'high') {
        setImportantCount(c => c + 1);
      }

      processedEmailsRef.current.push({
        ...email,
        category: cls.category,
        priority: cls.priority,
        actionTaken: chosenAction,
        suggestedAction: cls.suggested_action,
        actionStatus,
        rejectedReason,
      });
      setProcessedIndex(processedEmailsRef.current.length);
      resolvingEmailsRef.current.delete(email.id);
      pendingActionsRef.current--;
    }

    // Game loop
    const gameSpeed = 220; // px/sec

    const updateAndRender = (currentTime) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      if (fastForwardRef.current) {
        return;
      }

      // Physics update
      robot.vy += gravity * dt;
      robot.y += robot.vy * dt;

      if (robot.y >= groundY - robot.height) {
        robot.y = groundY - robot.height;
        robot.vy = 0;
        robot.isGrounded = true;
        robot.jumps = 0;
        robot.legPhase += dt * 15;
      }

      // Spawn obstacles
      spawnTimer -= dt;
      if (spawnTimer <= 0 && currentQueueIdx < emailQueue.length) {
        const item = emailQueue[currentQueueIdx++];
        const cat = item.classification.category;

        let type = 'junk';
        let obsY = groundY - 32;
        let obsW = 34;
        let obsH = 32;
        let color = '#d8d8d8';

        if (cat === 'newsletter') {
          type = 'overhead';
          obsY = groundY - 57;
          obsW = 66;
          obsH = 28;
          color = '#bdbdbd';
        } else if (cat === 'receipt_bill') {
          type = 'cargo';
          obsY = groundY - 28;
          obsW = 32;
          obsH = 28;
          color = '#b8b8b8';
        } else if (cat === 'important') {
          type = 'beacon';
          obsY = groundY - 110;
          obsW = 28;
          obsH = 34;
          color = '#eeeeee';
        } else if (cat === 'uncertain') {
          type = 'question';
          obsY = groundY - 65;
          obsW = 30;
          obsH = 30;
          color = '#858585';
        }

        activeObstacles.push({
          ...item,
          type,
          x: canvas.width + 20,
          y: obsY,
          width: obsW,
          height: obsH,
          color,
          resolved: false,
        });

        spawnTimer = spawnInterval;
      }

      // Clear background
      ctx.fillStyle = '#080808';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Distant stars
      ctx.fillStyle = '#1c1c1c';
      for (let s = 0; s < 30; s++) {
        const sx = ((s * 73 + currentTime * 0.02) % canvas.width);
        const sy = (s * 37) % (groundY - 50);
        ctx.fillRect(sx, sy, 2, 2);
      }

      // Ground platform
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, groundY, canvas.width, 3);

      // Running grid lines on ground
      ctx.strokeStyle = '#252525';
      ctx.lineWidth = 1;
      const gridOffset = (currentTime * 0.22) % 40;
      for (let gx = -gridOffset; gx < canvas.width; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, groundY);
        ctx.lineTo(gx - 60, canvas.height);
        ctx.stroke();
      }

      // Draw Robot Courier
      ctx.save();
      ctx.translate(robot.x, robot.y);
      if (robot.crouching) ctx.scale(1, 0.6);

      // Courier backpack / data core
      ctx.fillStyle = '#bdbdbd';
      ctx.beginPath();
      ctx.roundRect(-6, 8, 8, 20, 3);
      ctx.fill();

      // Main torso
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath();
      ctx.roundRect(0, 5, robot.width - 6, 26, 6);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Visor / Screen eye
      ctx.fillStyle = '#171717';
      ctx.beginPath();
      ctx.roundRect(14, 10, 16, 8, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(18, 12, 6, 4);

      // Antenna
      ctx.strokeStyle = '#d0d0d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 5);
      ctx.lineTo(15, -4);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(15, -5, 3, 0, Math.PI * 2);
      ctx.fill();

      // Animated legs
      ctx.fillStyle = '#737373';
      if (robot.isGrounded) {
        const leg1 = Math.sin(robot.legPhase) * 6;
        const leg2 = -leg1;
        ctx.fillRect(6, 31, 6, 12 + leg1);
        ctx.fillRect(20, 31, 6, 12 + leg2);
      } else {
        // Tucked jump legs
        ctx.fillRect(6, 31, 6, 8);
        ctx.fillRect(20, 31, 6, 8);
      }

      ctx.restore();

      // Update and draw obstacles
      for (let i = activeObstacles.length - 1; i >= 0; i--) {
        const obs = activeObstacles[i];
        obs.x -= gameSpeed * dt;

        // Collision check
        const collides =
          robot.x < obs.x + obs.width &&
          robot.x + robot.width > obs.x &&
          robot.y < obs.y + obs.height &&
          robot.y + robot.height > obs.y;

        const passed = obs.x + obs.width + 10 < robot.x;

        if (!obs.resolved) {
          if (collides) {
            obs.resolved = true;
            createBurst(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.color);
            heartsValue = Math.max(0, heartsValue - 1);
            setHearts(heartsValue);
            triggerTriage(obs);
          } else if (passed) {
            obs.resolved = true;
            createBurst(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.color);
            scoreValue += 25;
            setScore(scoreValue);
            triggerTriage(obs);
          }
        }

        // Draw obstacle
        ctx.save();
        if (obs.type === 'junk') {
          // Hazard junk pile
          ctx.fillStyle = obs.color;
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = '#444444';
          ctx.fillRect(obs.x + 4, obs.y + 4, obs.width - 8, obs.height - 8);
          // Label
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px sans-serif';
          ctx.fillText('PROMO', obs.x + 1, obs.y - 6);
        } else if (obs.type === 'overhead') {
          ctx.shadowColor = '#bdbdbd';
          ctx.shadowBlur = 14;
          ctx.fillStyle = obs.color;
          ctx.beginPath();
          ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 8);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#292929';
          ctx.fillRect(obs.x + 8, obs.y + obs.height - 5, 5, 13);
          ctx.fillRect(obs.x + obs.width - 13, obs.y + obs.height - 5, 5, 13);
          ctx.fillStyle = '#101010';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText('DUCK', obs.x + 20, obs.y + 17);
        } else if (obs.type === 'cargo') {
          // Green cargo box
          ctx.fillStyle = obs.color;
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = '#444444';
          ctx.fillRect(obs.x + 4, obs.y + 4, obs.width - 8, obs.height - 8);
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px sans-serif';
          ctx.fillText('BILL', obs.x + 6, obs.y - 6);
        } else if (obs.type === 'beacon') {
          // Glowing blue beacon
          const glow = Math.sin(currentTime * 0.008) * 4;
          ctx.shadowColor = '#bdbdbd';
          ctx.shadowBlur = 12 + glow;
          ctx.fillStyle = '#a8a8a8';
          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f2f2f2';
          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#f0f0f0';
          ctx.font = '10px sans-serif';
          ctx.fillText('ALERT', obs.x - 3, obs.y - 8);
        } else if (obs.type === 'question') {
          // Amber question box
          ctx.fillStyle = obs.color;
          ctx.beginPath();
          ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 4);
          ctx.fill();
          ctx.fillStyle = '#111111';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText('?', obs.x + 10, obs.y + 22);
          ctx.fillStyle = '#d0d0d0';
          ctx.font = '10px sans-serif';
          ctx.fillText('REVIEW', obs.x - 4, obs.y - 6);
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        const senderLabel = obs.email.sender.split('@')[0].slice(0, 15);
        ctx.fillText(senderLabel, obs.x - 12, obs.y - 20);
        ctx.font = '9px sans-serif';
        ctx.fillStyle = obs.type === 'question' ? '#d0d0d0' : obs.color;
        ctx.fillText(obs.classification.category.replace('_', ' ').toUpperCase(), obs.x - 12, obs.y - 8);
        ctx.restore();

        // Cull offscreen
        if (obs.x < -80) {
          activeObstacles.splice(i, 1);
        }
      }

      // Draw and update particles
      for (let p = particles.length - 1; p >= 0; p--) {
        const pt = particles[p];
        pt.life -= dt;
        if (pt.life <= 0) {
          particles.splice(p, 1);
          continue;
        }
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Top live progress bar
      const progress = emails.length > 0 ? processedEmailsRef.current.length / emails.length : 0;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, 6);
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width * progress, 6);

      // Check mission complete
      if (
        currentQueueIdx >= emailQueue.length &&
        activeObstacles.length === 0 &&
        processedEmailsRef.current.length === emails.length &&
        pendingActionsRef.current === 0 &&
        !missionFinished
      ) {
        missionFinished = true;
        missionCompleteScheduledRef.current = true;
        setTimeout(() => {
          onMissionComplete({
            appliedActions: appliedActionsRef.current,
            processedEmails: processedEmailsRef.current,
          });
        }, 800);
      }

      if (!missionFinished) {
        animationFrameId = requestAnimationFrame(updateAndRender);
      }
    };

    animationFrameId = requestAnimationFrame(updateAndRender);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      canvas.removeEventListener('pointerdown', jump);
      crouchActionRef.current = null;
      jumpActionRef.current = null;
    };
  }, [emails, classifications, onMissionComplete]);

  // Fast finish skip button for convenience
  const handleQuickFinish = async () => {
    if (fastForwardRef.current || missionCompleteScheduledRef.current) return;
    fastForwardRef.current = true;
    setFastForwarding(true);

    // Process any remaining emails immediately
    const alreadyProcessedIds = new Set([
      ...processedEmailsRef.current.map(p => p.id),
      ...resolvingEmailsRef.current,
    ]);
    const remaining = emails.filter(e => !alreadyProcessedIds.has(e.id));

    if (remaining.length > 0) {
      const remainingRecords = remaining.map(email => {
        const cls = classifications.find(c => c.id === email.id) || {};
        const needsReview = cls.category === 'uncertain' || cls.confidence < 0.85 ||
          cls.suggested_action === 'needs_review';
        const action = needsReview
          ? 'leave_in_inbox'
          : cls.priority === 'high' || cls.category === 'important'
            ? 'flag_important'
            : ['archive', 'label_read_later', 'flag_important', 'leave_in_inbox'].includes(cls.suggested_action)
              ? cls.suggested_action
              : 'leave_in_inbox';
        return { email, cls, action };
      });

      try {
        const res = await applyActions(remainingRecords.map(({ email, action }) => ({
          email_id: email.id,
          action,
        })));
        if (res.applied) appliedActionsRef.current.push(...res.applied);
        for (const { email, cls, action } of remainingRecords) {
          const applied = res.applied?.some(item => item.email_id === email.id);
          const rejected = res.rejected?.find(item => item.email_id === email.id);
          processedEmailsRef.current.push({
            ...email,
            category: cls.category || 'uncertain',
            priority: cls.priority || 'medium',
            actionTaken: action,
            suggestedAction: cls.suggested_action || 'needs_review',
            actionStatus: applied ? 'applied' : 'rejected',
            rejectedReason: rejected?.reason || '',
          });
        }
      } catch (err) {
        setToasts(prev => [...prev, {
          id: Date.now(),
          msg: err instanceof Error ? err.message : 'Some actions could not be completed.',
          type: 'review',
        }]);
        for (const { email, cls, action } of remainingRecords) {
          processedEmailsRef.current.push({
            ...email,
            category: cls.category || 'uncertain',
            priority: cls.priority || 'medium',
            actionTaken: action,
            suggestedAction: cls.suggested_action || 'needs_review',
            actionStatus: 'rejected',
            rejectedReason: err instanceof Error ? err.message : 'Action could not be completed.',
          });
        }
      }
    }

    while (pendingActionsRef.current > 0) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    onMissionComplete({
      appliedActions: appliedActionsRef.current,
      processedEmails: processedEmailsRef.current,
    });
  };

  return (
    <div className="game-screen-wrapper">
      <div className="game-hud">
        <div className="hud-item">
          <span>Emails:</span>
          <span className="hud-value">{processedIndex} / {emails.length}</span>
        </div>
        <div className="hud-item">
          <span>Archived:</span>
          <span className="hud-value">{cleanedCount}</span>
        </div>
        <div className="hud-item">
          <span>Important found:</span>
          <span className="hud-value">{importantCount}</span>
        </div>
        <div className="hud-item">
          <span>Review:</span>
          <span className="hud-value">{reviewCount}</span>
        </div>
        <div className="hud-item game-score">
          <span>Score {score}</span>
          <span aria-label={`${hearts} hearts remaining`}>{'♥'.repeat(hearts)}{'♡'.repeat(3 - hearts)}</span>
        </div>
      </div>

      <div className="canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          aria-label="Courier runner game. Jump to clear low obstacles and crouch under purple overhead barriers."
        />
        <div className="toast-overlay">
          {toasts.map(toast => (
            <div key={toast.id} className={`hud-toast ${toast.type}`}>
              {toast.msg}
            </div>
          ))}
        </div>
      </div>

      <div className="game-controls-hint">
        <div className="game-controls">
          <span className="control-copy">
            <strong>Jump</strong> Space / ↑ / tap <span aria-hidden="true">·</span>{' '}
            <strong>Crouch</strong> hold ↓ / S
          </span>
          <div className="touch-controls" aria-label="Touch game controls">
            <button type="button" className="touch-control" onClick={handleJump} aria-label="Jump">
              Jump <span aria-hidden="true">↑</span>
            </button>
            <button
              type="button"
              className={`touch-control crouch-control ${crouchActive ? 'active' : ''}`}
              aria-label="Hold to crouch"
              aria-pressed={crouchActive}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                handleCrouchChange(true);
              }}
              onPointerUp={() => handleCrouchChange(false)}
              onPointerCancel={() => handleCrouchChange(false)}
              onLostPointerCapture={() => handleCrouchChange(false)}
            >
              Crouch <span aria-hidden="true">↓</span>
            </button>
          </div>
          <button className="fast-forward-button" onClick={handleQuickFinish} disabled={fastForwarding}>
            {fastForwarding ? 'Finishing mission…' : 'Fast-forward →'}
          </button>
        </div>
      </div>
      <p className="game-safety-note">Courier moves are for fun — email actions are based on safe triage, never your score.</p>
    </div>
  );
}
