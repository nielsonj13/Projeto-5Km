document.addEventListener('DOMContentLoaded', () => {

    // --- SELETORES DE ELEMENTOS E VARIÁVEIS GLOBAIS ---
    // Elementos da página principal
    const trainingCells = document.querySelectorAll('.training-cell');
    const progressCounter = document.getElementById('progress-counter');
    const mainTitle = document.getElementById('main-title');
    const totalTrainings = trainingCells.length;
    
    // Chaves de armazenamento para o localStorage
    const storageKey = 'runningPlanProgress';
    const nameStorageKey = 'runnerName';
    const energySaverKey = 'energySaverActive';

    // Elementos do cronómetro
    const chronoModal = document.getElementById('chronometer-modal');
    const chronoStatus = document.getElementById('chrono-status');
    const chronoTime = document.getElementById('chrono-time');
    const chronoReps = document.getElementById('chrono-reps');
    const startPauseBtn = document.getElementById('chrono-start-pause-btn');
    const resetBtn = document.getElementById('chrono-reset-btn');
    const closeBtn = document.getElementById('chrono-close-btn');
    const energySaverBtn = document.getElementById('chrono-energy-saver-btn');

    // Variáveis de estado do cronómetro
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
                    console.log('Wake Lock ativado!');
                } catch (err) {
                    console.error(`${err.name}, ${err.message}`);
                }
            } else if (action === 'release' && wakeLock) {
                await wakeLock.release();
                wakeLock = null;
                console.log('Wake Lock libertado.');
            }
        }
    };
    
    // --- LÓGICA DO MODO POUPANÇA DE BATERIA ---
    const toggleEnergySaver = (forceState = null) => {
        const body = document.body;
        let shouldBeActive;
        if (forceState !== null) {
            shouldBeActive = forceState;
        } else {
            shouldBeActive = !body.classList.contains('energy-saver-overlay');
            localStorage.setItem(energySaverKey, shouldBeActive);
        }
        if (shouldBeActive) {
            body.classList.add('energy-saver-overlay');
            energySaverBtn.classList.add('active');
        } else {
            body.classList.remove('energy-saver-overlay');
            energySaverBtn.classList.remove('active');
        }
    };

    const loadEnergySaverPreference = () => {
        const isEnergySaverActive = localStorage.getItem(energySaverKey) === 'true';
        if (isEnergySaverActive) {
            toggleEnergySaver(true);
        }
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
    // Interpreta o texto da célula do treino para extrair os tempos e repetições
    const parseWorkoutText = (text) => {
        const runMatch = text.match(/Corra (\d+) min/);
        const walkMatch = text.match(/caminhe (\d+) min/);
        const repsMatch = text.match(/repita (\d+)x/);
        if (text.includes('km')) {
            return { type: 'distance', description: text };
        }
        const runTime = runMatch ? parseInt(runMatch[1], 10) * 60 : 0;
        const walkTime = walkMatch ? parseInt(walkMatch[1], 10) * 60 : 0;
        const reps = repsMatch ? parseInt(repsMatch[1], 10) : 1;
        return { type: 'interval', runTime, walkTime, totalReps: reps, currentRep: 1, isRunPhase: true, timeLeft: runTime, isPaused: true };
    };

    // Prepara e exibe o modal do cronómetro
    const setupAndShowChrono = (cell) => {
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
        resetChrono();
        chronoModal.classList.remove('hidden');
    };

    // Atualiza o ecrã do cronómetro (tempo, estado e repetições)
    const updateChronoDisplay = () => {
        const minutes = Math.floor(currentWorkout.timeLeft / 60).toString().padStart(2, '0');
        const seconds = (currentWorkout.timeLeft % 60).toString().padStart(2, '0');
        chronoTime.textContent = `${minutes}:${seconds}`;
        if (currentWorkout.isRunPhase) {
            chronoStatus.textContent = "CORRA!";
        } else {
            chronoStatus.textContent = "CAMINHE";
        }
        chronoReps.textContent = `Repetições: ${currentWorkout.currentRep}/${currentWorkout.totalReps}`;
    };

    // A função principal que corre a cada segundo
    const timerTick = () => {
        if (currentWorkout.isPaused) return;
        currentWorkout.timeLeft--;
        updateChronoDisplay();
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

    // É chamada quando todas as repetições terminam
    const finishWorkout = () => {
        clearInterval(timerInterval);
        finishSound.play();
        manageWakeLock('release');
        chronoStatus.textContent = "TREINO CONCLUÍDO!";
        activeCell.classList.add('completed');
        saveProgress();
        updateProgressCounter();
        setTimeout(() => chronoModal.classList.add('hidden'), 2000);
    };
    
    // --- FUNÇÕES DE CONTROLO DO CRONÓMETRO ---
    // Controla o botão de Iniciar/Pausar/Continuar
    const toggleStartPause = () => {
        currentWorkout.isPaused = !currentWorkout.isPaused;
        startPauseBtn.textContent = currentWorkout.isPaused ? 'Continuar' : 'Pausar';
        if (!currentWorkout.isPaused) {
            manageWakeLock('request');
        } else {
            manageWakeLock('release');
        }
        // Apenas executa na primeira vez que se clica em "Iniciar"
        if (!currentWorkout.isPaused && !timerInterval) {
            startSound.play();
            // "Destrava" os outros áudios para o navegador móvel
            runSound.play(); runSound.pause(); runSound.currentTime = 0;
            walkSound.play(); walkSound.pause(); walkSound.currentTime = 0;
            finishSound.play(); finishSound.pause(); finishSound.currentTime = 0;
            // Inicia o temporizador
            timerInterval = setInterval(timerTick, 1000);
        }
    };

    // Reseta o cronómetro para o estado inicial
    const resetChrono = () => {
        clearInterval(timerInterval);
        timerInterval = null;
        manageWakeLock('release');
        currentWorkout.isRunPhase = true;
        currentWorkout.timeLeft = currentWorkout.runTime;
        currentWorkout.currentRep = 1;
        currentWorkout.isPaused = true;
        startPauseBtn.textContent = 'Iniciar';
        updateChronoDisplay();
    };

    // Fecha o modal do cronómetro
    const closeChrono = () => {
        clearInterval(timerInterval);
        timerInterval = null;
        manageWakeLock('release');
        chronoModal.classList.add('hidden');
    };
    
    // --- EVENT LISTENERS (OUVINTES DE EVENTOS) ---
    // Adiciona a funcionalidade de clique a todos os elementos interativos
    trainingCells.forEach(cell => {
        cell.addEventListener('click', () => setupAndShowChrono(cell));
    });

    startPauseBtn.addEventListener('click', toggleStartPause);
    resetBtn.addEventListener('click', resetChrono);
    closeBtn.addEventListener('click', closeChrono);
    energySaverBtn.addEventListener('click', () => toggleEnergySaver());

    // --- INICIALIZAÇÃO DA PÁGINA ---
    // Funções que são executadas assim que a página carrega
    personalizeGreeting();
    loadProgress();
    loadEnergySaverPreference();
});