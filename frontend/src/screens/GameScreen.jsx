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
      y: groundY - 38,
      width: 60,
      height: 38,
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
      robot.height = isCrouching ? 25 : 38;
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

      // Deep-space backdrop
      ctx.fillStyle = '#08090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const horizonGlow = ctx.createLinearGradient(0, groundY - 95, 0, groundY + 10);
      horizonGlow.addColorStop(0, 'rgba(255, 255, 255, 0)');
      horizonGlow.addColorStop(1, 'rgba(255, 255, 255, 0.055)');
      ctx.fillStyle = horizonGlow;
      ctx.fillRect(0, groundY - 95, canvas.width, 105);

      // Distant stars
      for (let s = 0; s < 30; s++) {
        const sx = ((s * 73 + currentTime * 0.02) % canvas.width);
        const sy = (s * 37) % (groundY - 50);
        const starSize = s % 5 === 0 ? 2 : 1;
        ctx.fillStyle = s % 5 === 0 ? 'rgba(235, 239, 244, 0.52)' : 'rgba(190, 198, 208, 0.3)';
        ctx.fillRect(sx, sy, starSize, starSize);
      }

      // Distant moon gives the route a clear horizon and sense of depth.
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = '#d7dde4';
      ctx.beginPath();
      ctx.arc(735, 115, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#d7dde4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(735, 115, 70, 18, -0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Flat, high-contrast runway.
      ctx.fillStyle = '#111316';
      ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
      ctx.fillStyle = '#dce1e7';
      ctx.fillRect(0, groundY, canvas.width, 3);
      ctx.fillStyle = 'rgba(220, 225, 231, 0.13)';
      ctx.fillRect(0, groundY + 3, canvas.width, 1);

      // Subtle ground motion, kept below the play lane.
      ctx.strokeStyle = '#25292e';
      ctx.lineWidth = 1;
      const gridOffset = (currentTime * 0.22) % 40;
      for (let gx = -gridOffset; gx < canvas.width; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, groundY);
        ctx.lineTo(gx - 48, canvas.height);
        ctx.stroke();
      }

      // Draw the courier UFO.
      ctx.save();
      const flightHeight = Math.max(0, groundY - (robot.y + robot.height));
      const hover = robot.isGrounded ? Math.sin(currentTime * 0.006) * 2 : 0;
      const saucerX = robot.x + robot.width / 2;
      const saucerY = robot.y + robot.height * 0.25 + hover;
      const beamHeight = robot.crouching ? 9 : 15;

      ctx.globalAlpha = Math.max(0.08, 0.24 - flightHeight / 950);
      ctx.fillStyle = '#dfe7ef';
      ctx.beginPath();
      ctx.ellipse(saucerX, groundY + 8, Math.max(13, 30 - flightHeight * 0.08), 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.globalAlpha = robot.isGrounded ? 0.25 : 0.4;
      ctx.fillStyle = '#d7e1eb';
      ctx.beginPath();
      ctx.moveTo(saucerX - 10, saucerY + 3);
      ctx.lineTo(saucerX + 10, saucerY + 3);
      ctx.lineTo(saucerX + 21, saucerY + beamHeight);
      ctx.lineTo(saucerX - 21, saucerY + beamHeight);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#242a31';
      ctx.beginPath();
      ctx.ellipse(saucerX, saucerY + 7, 29, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f1f4f7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(saucerX, saucerY + 7, 29, 10, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#e5e9ed';
      ctx.beginPath();
      ctx.ellipse(saucerX, saucerY + 2, 19, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#b9c3cc';
      ctx.beginPath();
      ctx.ellipse(saucerX, saucerY - 2, 12, 10, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f7f8fa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(saucerX, saucerY - 2, 12, 10, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      for (let light = -1; light <= 1; light++) {
        ctx.fillStyle = Math.sin(currentTime * 0.008 + light) > -0.35 ? '#ffffff' : '#9da8b2';
        ctx.beginPath();
        ctx.arc(saucerX + light * 16, saucerY + 8, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Update and draw obstacles
      for (let i = activeObstacles.length - 1; i >= 0; i--) {
        const obs = activeObstacles[i];
        obs.x -= gameSpeed * dt;

        // Collision check
        const hitbox = {
          x: robot.x + 8,
          y: robot.y + 7,
          width: robot.width - 16,
          height: robot.height - 11,
        };
        const collides =
          hitbox.x < obs.x + obs.width &&
          hitbox.x + hitbox.width > obs.x &&
          hitbox.y < obs.y + obs.height &&
          hitbox.y + hitbox.height > obs.y;

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
          ctx.fillStyle = '#252b32';
          ctx.strokeStyle = '#e5e9ed';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(obs.x, obs.y + 2, obs.width, obs.height - 2, 5);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#f2f4f6';
          ctx.beginPath();
          ctx.moveTo(obs.x + 6, obs.y + 9);
          ctx.lineTo(obs.x + obs.width / 2, obs.y + 19);
          ctx.lineTo(obs.x + obs.width - 6, obs.y + 9);
          ctx.stroke();
        } else if (obs.type === 'overhead') {
          ctx.fillStyle = '#dfe4e9';
          ctx.beginPath();
          ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 6);
          ctx.fill();
          ctx.fillStyle = '#111417';
          ctx.beginPath();
          ctx.moveTo(obs.x + 7, obs.y + 8);
          ctx.lineTo(obs.x + obs.width / 2, obs.y + 19);
          ctx.lineTo(obs.x + obs.width - 7, obs.y + 8);
          ctx.strokeStyle = '#111417';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillRect(obs.x + 8, obs.y + obs.height - 2, 4, 8);
          ctx.fillRect(obs.x + obs.width - 12, obs.y + obs.height - 2, 4, 8);
        } else if (obs.type === 'cargo') {
          ctx.fillStyle = '#e1e5e9';
          ctx.beginPath();
          ctx.roundRect(obs.x + 2, obs.y, obs.width - 4, obs.height, 3);
          ctx.fill();
          ctx.fillStyle = '#30363d';
          ctx.fillRect(obs.x + 8, obs.y + 7, obs.width - 16, 2);
          ctx.fillRect(obs.x + 8, obs.y + 13, obs.width - 13, 2);
          ctx.fillRect(obs.x + 8, obs.y + 19, obs.width - 18, 2);
        } else if (obs.type === 'beacon') {
          const pulse = 0.75 + Math.sin(currentTime * 0.006) * 0.15;
          ctx.globalAlpha = pulse * 0.22;
          ctx.fillStyle = '#f2f5f8';
          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#252b32';
          ctx.strokeStyle = '#e6ebef';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(obs.x + 1, obs.y + 3, obs.width - 2, 25, 5);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#f3f5f7';
          ctx.beginPath();
          ctx.moveTo(obs.x + 6, obs.y + 10);
          ctx.lineTo(obs.x + obs.width / 2, obs.y + 19);
          ctx.lineTo(obs.x + obs.width - 6, obs.y + 10);
          ctx.stroke();
        } else if (obs.type === 'question') {
          ctx.fillStyle = '#252b32';
          ctx.strokeStyle = '#cbd2d9';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#f4f6f8';
          ctx.font = 'bold 19px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('?', obs.x + obs.width / 2, obs.y + 21);
          ctx.textAlign = 'left';
        }

        const senderLabel = obs.email.sender.split('@')[0].slice(0, 15);
        const categoryLabel = obs.classification.category.replace('_', ' ').toUpperCase();
        ctx.font = 'bold 12px sans-serif';
        const labelWidth = Math.max(ctx.measureText(senderLabel).width, ctx.measureText(categoryLabel).width) + 16;
        const labelX = obs.x + obs.width / 2 - labelWidth / 2;
        const labelY = obs.y - 39;
        ctx.fillStyle = 'rgba(17, 20, 23, 0.94)';
        ctx.beginPath();
        ctx.roundRect(labelX, labelY, labelWidth, 36, 5);
        ctx.fill();
        ctx.fillStyle = '#f2f4f6';
        ctx.textAlign = 'center';
        ctx.fillText(senderLabel, obs.x + obs.width / 2, labelY + 14);
        ctx.fillStyle = '#bec6ce';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(categoryLabel, obs.x + obs.width / 2, labelY + 29);
        ctx.textAlign = 'left';
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
          aria-label="Courier UFO runner game. Jump to clear low email hazards and crouch beneath overhead mail."
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
