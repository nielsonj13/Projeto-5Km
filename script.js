document.addEventListener('DOMContentLoaded', () => {

    // --- SELETORES DE ELEMENTOS E VARIÁVEIS GLOBAIS ---
    const mainTitle = document.getElementById('main-title');
    const trainingCells = document.querySelectorAll('.training-cell');
    const progressCounter = document.getElementById('progress-counter');
    const totalTrainings = trainingCells.length;
    const chronoModal = document.getElementById('chronometer-modal');
    const chronoContainer = document.querySelector('.chrono-container');
    const chronoStatus = document.getElementById('chrono-status');
    const chronoTime = document.getElementById('chrono-time');
    const chronoReps = document.getElementById('chrono-reps');
    const startPauseBtn = document.getElementById('chrono-start-pause-btn');
    const resetBtn = document.getElementById('chrono-reset-btn');
    const closeBtn = document.getElementById('chrono-close-btn');
    const screenOffBtn = document.getElementById('chrono-screen-off-btn');
    const exitScreenOffBtn = document.getElementById('exit-screen-off-btn');
    const muteBtn = document.getElementById('chrono-mute-btn');

    const storageKey = 'runningPlanProgress';
    const nameStorageKey = 'runnerName';
    const screenOffKey = 'screenOffActive';
    const muteKey = 'muteActive';

    let timerInterval = null;
    let currentWorkout = {};
    let activeCell = null;
    let wakeLock = null;
    let isMuted = false;

    // --- ÁUDIOS DO PROJETO ---
    const startSound = new Audio('iniciar.opus');
    const runSound = new Audio('correr.opus');
    const walkSound = new Audio('caminhar.opus');
    const finishSound = new Audio('finalizar.opus');
    
    // --- LÓGICA DE FEEDBACK (SOM OU VIBRAÇÃO) ---
    const playFeedback = (sound, vibrationPattern = [500]) => {
        if (isMuted) {
            if ('vibrate' in navigator) {
                navigator.vibrate(vibrationPattern);
            }
        } else {
            sound.play();
        }
    };

    // --- LÓGICA DO MUTE ---
    const setMuteState = (shouldBeMuted) => {
        isMuted = shouldBeMuted;
        muteBtn.classList.toggle('muted', isMuted);
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
        localStorage.setItem(muteKey, isMuted);
    };

    const toggleMute = () => {
        setMuteState(!isMuted);
    };

    const loadMutePreference = () => {
        const isMuteActive = localStorage.getItem(muteKey) === 'true';
        setMuteState(isMuteActive);
    };

    // --- LÓGICA DO WAKE LOCK (MANTER ECRÃ ATIVO) ---
    const manageWakeLock = async (action) => {
        if ('wakeLock' in navigator) {
            if (action === 'request' && !wakeLock) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('Wake Lock ativado/reativado!');
                } catch (err) { console.error(`${err.name}, ${err.message}`); }
            } else if (action === 'release' && wakeLock) {
                await wakeLock.release();
                wakeLock = null;
                console.log('Wake Lock libertado.');
            }
        }
    };

    // --- LÓGICA DE VISIBILIDADE DA PÁGINA ---
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && timerInterval && !currentWorkout.isPaused) {
            manageWakeLock('request');
        }
    };

    // --- LÓGICA DO MODO ECRÃ PRETO ---
    const setScreenOffMode = (shouldBeActive) => {
        document.body.classList.toggle('black-screen-mode', shouldBeActive);
        screenOffBtn.classList.toggle('active', shouldBeActive);
    };

    const toggleScreenOffMode = () => {
        const willBeActive = !document.body.classList.contains('black-screen-mode');
        localStorage.setItem(screenOffKey, willBeActive);
        setScreenOffMode(willBeActive);
    };

    // --- LÓGICA DE PERSONALIZAÇÃO ---
    const personalizeGreeting = () => {
        let runnerName = localStorage.getItem(nameStorageKey);
        if (!runnerName) {
            runnerName = prompt("Olá! Para personalizar seu plano, por favor, digite seu nome:", "");
            if (runnerName && runnerName.trim() !== "") {
                localStorage.setItem(nameStorageKey, runnerName);
                mainTitle.textContent = `Projeto 5Km de ${runnerName}`;
            } else {
                mainTitle.textContent = 'Projeto 5Km';
            }
        } else {
            mainTitle.textContent = `Projeto 5Km de ${runnerName}`;
        }
    };

    // --- LÓGICA DE PROGRESSO ---
    const loadProgress = () => {
        const savedProgress = JSON.parse(localStorage.getItem(storageKey)) || [];
        savedProgress.forEach(cellIndex => {
            trainingCells[cellIndex].classList.add('completed');
        });
        updateProgressCounter();
    };
    const saveProgress = () => {
        const completedCells = [];
        trainingCells.forEach((cell, index) => {
            if (cell.classList.contains('completed')) {
                completedCells.push(index);
            }
        });
        localStorage.setItem(storageKey, JSON.stringify(completedCells));
    };
    const updateProgressCounter = () => {
        const completedCount = document.querySelectorAll('.training-cell.completed').length;
        progressCounter.textContent = `Você completou ${completedCount} de 24 treinos.`;
    };

    // --- LÓGICA PRINCIPAL DO CRONÓMETRO ---
    const parseWorkoutText = (text) => {
        const runMatch = text.match(/Corra (\d+) min/);
        const walkMatch = text.match(/caminhe (\d+) min/);
        const repsMatch = text.match(/repita (\d+)x/);
        if (text.includes('km')) return { type: 'distance', description: text };
        const runTime = runMatch ? parseInt(runMatch[1], 10) * 60 : 0;
        const walkTime = walkMatch ? parseInt(walkMatch[1], 10) * 60 : 0;
        const reps = repsMatch ? parseInt(repsMatch[1], 10) : 1;
        return { type: 'interval', runTime, walkTime, totalReps: reps, currentRep: 1, isRunPhase: true, timeLeft: runTime, isPaused: true };
    };
    const updateChronoDisplay = () => {
        const minutes = Math.floor(currentWorkout.timeLeft / 60).toString().padStart(2, '0');
        const seconds = (currentWorkout.timeLeft % 60).toString().padStart(2, '0');
        chronoTime.textContent = `${minutes}:${seconds}`;
        chronoStatus.textContent = currentWorkout.isRunPhase ? "CORRA!" : "CAMINHE";
        chronoReps.textContent = `Repetições: ${currentWorkout.currentRep}/${currentWorkout.totalReps}`;
    };
    const timerTick = () => {
        if (currentWorkout.isPaused) return;
        currentWorkout.timeLeft--;

        if (!document.body.classList.contains('black-screen-mode')) {
            updateChronoDisplay();
        }

        if (currentWorkout.timeLeft < 0) {
            if (currentWorkout.isRunPhase && currentWorkout.walkTime > 0) {
                playFeedback(walkSound);
                currentWorkout.isRunPhase = false;
                currentWorkout.timeLeft = currentWorkout.walkTime;
            } else {
                currentWorkout.currentRep++;
                if (currentWorkout.currentRep <= currentWorkout.totalReps) {
                    playFeedback(runSound);
                    currentWorkout.isRunPhase = true;
                    currentWorkout.timeLeft = currentWorkout.runTime;
                } else {
                    finishWorkout();
                }
            }
        }
    };

    // --- FUNÇÕES DE CONTROLO DO CRONÓMETRO ---
    const openChrono = (cell) => {
        const workoutText = cell.textContent;
        currentWorkout = parseWorkoutText(workoutText);
        activeCell = cell;
        if (currentWorkout.type === 'distance') {
            alert(`Treino de hoje: ${currentWorkout.description}. Use um app de corrida para marcar a distância. Clique em 'OK' para marcar como concluído.`);
            cell.classList.add('completed');
            saveProgress();
            updateProgressCounter();
            return;
        }
        currentWorkout.isPaused = true;
        startPauseBtn.textContent = 'Iniciar';
        updateChronoDisplay();
        chronoModal.classList.remove('hidden');
        const isScreenOffActive = localStorage.getItem(screenOffKey) === 'true';
        setScreenOffMode(isScreenOffActive);
    };
    const handleCellClick = (cell) => {
        if (cell.classList.contains('completed')) {
            if (confirm("Este treino já está concluído. Deseja marcá-lo como não concluído?")) {
                cell.classList.remove('completed');
                saveProgress();
                updateProgressCounter();
            }
        } else {
            openChrono(cell);
        }
    };
    const closeChrono = () => {
        clearInterval(timerInterval);
        timerInterval = null;
        manageWakeLock('release');
        chronoModal.classList.add('hidden');
        setScreenOffMode(false);
    };
    const finishWorkout = () => {
        playFeedback(finishSound, [500, 200, 500]);
        activeCell.classList.add('completed');
        saveProgress();
        updateProgressCounter();
        chronoStatus.textContent = "TREINO CONCLUÍDO!";
        setTimeout(closeChrono, 2000);
    };
    const toggleStartPause = () => {
        currentWorkout.isPaused = !currentWorkout.isPaused;
        startPauseBtn.textContent = currentWorkout.isPaused ? 'Continuar' : 'Pausar';
        manageWakeLock(currentWorkout.isPaused ? 'release' : 'request');
        if (!currentWorkout.isPaused && !timerInterval) {
            playFeedback(startSound);
// "Destrava" os outros áudios para o navegador móvel
            runSound.play(); runSound.pause(); runSound.currentTime = 0;
            walkSound.play(); walkSound.pause(); walkSound.currentTime = 0;
            finishSound.play(); finishSound.pause(); finishSound.currentTime = 0;
            timerInterval = setInterval(timerTick, 1000);
        }
    };
    
    // --- EVENT LISTENERS (OUVINTES DE EVENTOS) ---
    trainingCells.forEach(cell => { cell.addEventListener('click', () => handleCellClick(cell)); });
    
    startPauseBtn.addEventListener('click', toggleStartPause);
    
    resetBtn.addEventListener('click', () => {
        if (confirm("Tem a certeza que deseja resetar o cronómetro e começar este treino do início?")) {
            closeChrono();
            openChrono(activeCell);
        }
    });

    closeBtn.addEventListener('click', closeChrono);
    screenOffBtn.addEventListener('click', toggleScreenOffMode);
    exitScreenOffBtn.addEventListener('click', toggleScreenOffMode);
    muteBtn.addEventListener('click', toggleMute);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // --- INICIALIZAÇÃO DA PÁGINA ---
    personalizeGreeting();
    loadProgress();
    loadMutePreference();
});