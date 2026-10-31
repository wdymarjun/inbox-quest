import React, { useEffect, useRef, useState } from 'react';
import { applyActions } from '../api';

export function GameScreen({ emails, classifications, onMissionComplete }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [toasts, setToasts] = useState([]);
  const [cleanedCount, setCleanedCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [processedIndex, setProcessedIndex] = useState(0);

  // Store actions applied for undo
  const appliedActionsRef = useRef([]);
  const processedEmailsRef = useRef([]);

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

    // Keyboard controls
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (robot.jumps < robot.maxJumps) {
          robot.vy = jumpVelocity;
          robot.isGrounded = false;
          robot.jumps++;

          // Jump thruster particles
          for (let i = 0; i < 8; i++) {
            particles.push({
              x: robot.x + 10 + Math.random() * 20,
              y: robot.y + robot.height,
              vx: (Math.random() - 0.5) * 100,
              vy: Math.random() * 150 + 50,
              color: '#60a5fa',
              size: Math.random() * 4 + 2,
              life: 0.35,
              maxLife: 0.35,
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

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
    async function triggerTriage(obstacle, actionType) {
      const email = obstacle.email;
      const cls = obstacle.classification;
      const snippetShort = email.subject.length > 32 ? email.subject.substring(0, 32) + '...' : email.subject;

      let chosenAction = cls.suggested_action;
      if (chosenAction === 'needs_review') {
        chosenAction = 'leave_in_inbox';
      }

      if (actionType === 'flag') {
        chosenAction = 'flag_important';
        addToast(`Flagged: ${snippetShort}`, 'flag');
        setCleanedCount(c => c + 1);
      } else if (actionType === 'review') {
        chosenAction = 'leave_in_inbox';
        addToast(`Needs Review: ${snippetShort}`, 'review');
        setReviewCount(r => r + 1);
      } else {
        chosenAction = cls.suggested_action === 'label_read_later' ? 'label_read_later' : 'archive';
        addToast(`Archived: ${snippetShort}`, 'archive');
        setCleanedCount(c => c + 1);
      }

      // Apply to backend or fallback state
      try {
        const res = await applyActions([{ email_id: email.id, action: chosenAction }]);
        if (res.applied && res.applied.length > 0) {
          appliedActionsRef.current.push(...res.applied);
        } else {
          // If rejected or mock
          appliedActionsRef.current.push({
            action_id: `act-local-${email.id}`,
            email_id: email.id,
            action: chosenAction,
            applied_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed applying action:', err);
      }

      processedEmailsRef.current.push({
        ...email,
        category: cls.category,
        priority: cls.priority,
        actionTaken: chosenAction,
        isSuggestion: false,
      });

      setProcessedIndex(processedEmailsRef.current.length);
    }

    // Game loop
    const gameSpeed = 220; // px/sec

    const updateAndRender = (currentTime) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

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

        let type = 'junk'; // promotion / newsletter
        let obsY = groundY - 32;
        let obsW = 34;
        let obsH = 32;
        let color = '#f97316'; // orange

        if (cat === 'receipt_bill') {
          type = 'cargo';
          obsY = groundY - 28;
          obsW = 32;
          obsH = 28;
          color = '#22c55e'; // green
        } else if (cat === 'important') {
          type = 'beacon';
          obsY = groundY - 110; // high beacon requires jumping
          obsW = 28;
          obsH = 34;
          color = '#38bdf8'; // sky blue glowing
        } else if (cat === 'uncertain') {
          type = 'question';
          obsY = groundY - 65; // mid-air
          obsW = 30;
          obsH = 30;
          color = '#fbbf24'; // amber
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
      ctx.fillStyle = '#0b1329';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Distant stars
      ctx.fillStyle = '#1e293b';
      for (let s = 0; s < 30; s++) {
        const sx = ((s * 73 + currentTime * 0.02) % canvas.width);
        const sy = (s * 37) % (groundY - 50);
        ctx.fillRect(sx, sy, 2, 2);
      }

      // Ground platform
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, groundY, canvas.width, 3);

      // Running grid lines on ground
      ctx.strokeStyle = '#334155';
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

      // Courier backpack / data core
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.roundRect(-6, 8, 8, 20, 3);
      ctx.fill();

      // Main torso
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(0, 5, robot.width - 6, 26, 6);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Visor / Screen eye
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.roundRect(14, 10, 16, 8, 3);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(18, 12, 6, 4);

      // Antenna
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 5);
      ctx.lineTo(15, -4);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(15, -5, 3, 0, Math.PI * 2);
      ctx.fill();

      // Animated legs
      ctx.fillStyle = '#475569';
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

        // Passed safely check
        const passed = robot.x > obs.x + obs.width + 10;

        if (!obs.resolved) {
          if (collides) {
            obs.resolved = true;
            createBurst(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.color);

            if (obs.type === 'beacon') {
              triggerTriage(obs, 'flag');
            } else if (obs.type === 'cargo' || obs.type === 'junk') {
              triggerTriage(obs, 'archive');
            } else if (obs.type === 'question') {
              triggerTriage(obs, 'review');
            }
          } else if (passed) {
            obs.resolved = true;
            createBurst(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.color);

            if (obs.type === 'junk' || obs.type === 'cargo') {
              // Successfully jumped over junk / skipped cargo -> archive
              triggerTriage(obs, 'archive');
            } else if (obs.type === 'beacon') {
              // Beacon still flagged for safety even if dodged
              triggerTriage(obs, 'flag');
            } else if (obs.type === 'question') {
              triggerTriage(obs, 'review');
            }
          }
        }

        // Draw obstacle
        ctx.save();
        if (obs.type === 'junk') {
          // Hazard junk pile
          ctx.fillStyle = obs.color;
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(obs.x + 4, obs.y + 4, obs.width - 8, obs.height - 8);
          // Label
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px sans-serif';
          ctx.fillText('PROMO', obs.x + 1, obs.y - 6);
        } else if (obs.type === 'cargo') {
          // Green cargo box
          ctx.fillStyle = obs.color;
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(obs.x + 4, obs.y + 4, obs.width - 8, obs.height - 8);
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px sans-serif';
          ctx.fillText('BILL', obs.x + 6, obs.y - 6);
        } else if (obs.type === 'beacon') {
          // Glowing blue beacon
          const glow = Math.sin(currentTime * 0.008) * 4;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 12 + glow;
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e0f2fe';
          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#38bdf8';
          ctx.font = '10px sans-serif';
          ctx.fillText('ALERT', obs.x - 3, obs.y - 8);
        } else if (obs.type === 'question') {
          // Amber question box
          ctx.fillStyle = obs.color;
          ctx.beginPath();
          ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 4);
          ctx.fill();
          ctx.fillStyle = '#78350f';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText('?', obs.x + 10, obs.y + 22);
          ctx.fillStyle = '#fbbf24';
          ctx.font = '10px sans-serif';
          ctx.fillText('REVIEW', obs.x - 4, obs.y - 6);
        }
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
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, 6);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, 0, canvas.width * progress, 6);

      // Check mission complete
      if (
        currentQueueIdx >= emailQueue.length &&
        activeObstacles.length === 0 &&
        !missionFinished
      ) {
        missionFinished = true;
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
    };
  }, [emails, classifications, onMissionComplete]);

  // Fast finish skip button for convenience
  const handleQuickFinish = async () => {
    // Process any remaining emails immediately
    const alreadyProcessedIds = new Set(processedEmailsRef.current.map(p => p.id));
    const remaining = emails.filter(e => !alreadyProcessedIds.has(e.id));

    if (remaining.length > 0) {
      const actionsToApply = remaining.map(e => {
        const cls = classifications.find(c => c.id === e.id) || { suggested_action: 'archive' };
        let action = cls.suggested_action === 'needs_review' ? 'leave_in_inbox' : cls.suggested_action;
        return { email_id: e.id, action };
      });

      try {
        const res = await applyActions(actionsToApply);
        if (res.applied) {
          appliedActionsRef.current.push(...res.applied);
        }
      } catch (err) {
        console.error(err);
      }

      for (const rem of remaining) {
        const cls = classifications.find(c => c.id === rem.id) || {};
        processedEmailsRef.current.push({
          ...rem,
          category: cls.category || 'promotion',
          priority: cls.priority || 'low',
          actionTaken: cls.suggested_action === 'needs_review' ? 'leave_in_inbox' : (cls.suggested_action || 'archive'),
          isSuggestion: false,
        });
      }
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
          <span>Cleaned:</span>
          <span className="hud-value">{cleanedCount}</span>
        </div>
        <div className="hud-item">
          <span>Review:</span>
          <span className="hud-value" style={{ color: '#d97706' }}>{reviewCount}</span>
        </div>
      </div>

      <div className="canvas-container" ref={containerRef}>
        <canvas ref={canvasRef} />
        <div className="toast-overlay">
          {toasts.map(toast => (
            <div key={toast.id} className={`hud-toast ${toast.type}`}>
              {toast.msg}
            </div>
          ))}
        </div>
      </div>

      <div className="game-controls-hint">
        <span>🎮 <strong>Controls:</strong> Press <strong>SPACE</strong> or <strong>UP ARROW</strong> to Jump / Double-Jump.</span>
        <button
          onClick={handleQuickFinish}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-blue)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            textDecoration: 'underline'
          }}
        >
          Fast-Forward Mission →
        </button>
      </div>
    </div>
  );
}
