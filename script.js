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

    const storageKey = 'runningPlanProgress';
    const nameStorageKey = 'runnerName';
    const screenOffKey = 'screenOffActive';

    let timerInterval = null;
    let currentWorkout = {};
    let activeCell = null;
    let wakeLock = null;

    // --- ÁUDIOS DO PROJETO ---
    const startSound = new Audio('iniciar.opus');
    const runSound = new Audio('correr.opus');
    const walkSound = new Audio('caminhar.opus');
    const finishSound = new Audio('finalizar.opus');

    // --- LÓGICA DO WAKE LOCK (MANTER ECRÃ ATIVO) ---
    const manageWakeLock = async (action) => {
        if ('wakeLock' in navigator) {
            if (action === 'request' && !wakeLock) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                } catch (err) { console.error(`${err.name}, ${err.message}`); }
            } else if (action === 'release' && wakeLock) {
                await wakeLock.release();
                wakeLock = null;
            }
        }
    };

    // --- LÓGICA DO MODO ECRÃ PRETO (POUPANÇA MÁXIMA) ---
    const setScreenOffMode = (shouldBeActive) => {
        document.body.classList.toggle('black-screen-mode', shouldBeActive);
        screenOffBtn.classList.toggle('active', shouldBeActive);
    };

    const toggleScreenOffMode = () => {
        const willBeActive = !document.body.classList.contains('black-screen-mode');
        localStorage.setItem(screenOffKey, willBeActive);
        setScreenOffMode(willBeActive);
    };

    // --- LÓGICA DE PERSONALIZAÇÃO (NOME DO UTILIZADOR) ---
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

    // --- LÓGICA DE PROGRESSO (CARREGAR E SALVAR) ---
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
    
    // -- FUNÇÃO OTIMIZADA --
    const timerTick = () => {
        if (currentWorkout.isPaused) return;
        currentWorkout.timeLeft--;

        // Otimização de Bateria: Só atualiza a interface visual se o ecrã não estiver preto.
        // A contagem do tempo e os alertas sonoros continuam a funcionar em fundo.
        if (!document.body.classList.contains('black-screen-mode')) {
            updateChronoDisplay();
        }

        if (currentWorkout.timeLeft < 0) {
            if (currentWorkout.isRunPhase && currentWorkout.walkTime > 0) {
                walkSound.play();
                currentWorkout.isRunPhase = false;
                currentWorkout.timeLeft = currentWorkout.walkTime;
            } else {
                currentWorkout.currentRep++;
                if (currentWorkout.currentRep <= currentWorkout.totalReps) {
                    runSound.play();
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
    
    const closeChrono = () => {
        clearInterval(timerInterval);
        timerInterval = null;
        manageWakeLock('release');
        chronoModal.classList.add('hidden');
        setScreenOffMode(false);
    };
    
    const finishWorkout = () => {
        finishSound.play();
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
            startSound.play();
            runSound.play(); runSound.pause(); runSound.currentTime = 0;
            walkSound.play(); walkSound.pause(); walkSound.currentTime = 0;
            finishSound.play(); finishSound.pause(); finishSound.currentTime = 0;
            timerInterval = setInterval(timerTick, 1000);
        }
    };
    
    // --- EVENT LISTENERS (OUVINTES DE EVENTOS) ---
    trainingCells.forEach(cell => { cell.addEventListener('click', () => openChrono(cell)); });
    startPauseBtn.addEventListener('click', toggleStartPause);
    resetBtn.addEventListener('click', () => openChrono(activeCell));
    closeBtn.addEventListener('click', closeChrono);
    screenOffBtn.addEventListener('click', toggleScreenOffMode);
    exitScreenOffBtn.addEventListener('click', toggleScreenOffMode);

    // --- INICIALIZAÇÃO DA PÁGINA ---
    personalizeGreeting();
    loadProgress();
});