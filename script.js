document.addEventListener('DOMContentLoaded', () => {
    // Elementos da página principal
    const trainingCells = document.querySelectorAll('.training-cell');
    const progressCounter = document.getElementById('progress-counter');
    const mainTitle = document.getElementById('main-title');
    const totalTrainings = trainingCells.length;
    
    // Chaves de armazenamento
    const storageKey = 'runningPlanProgress';
    const nameStorageKey = 'runnerName';

    // Elementos do cronômetro
    const chronoModal = document.getElementById('chronometer-modal');
    const chronoStatus = document.getElementById('chrono-status');
    const chronoTime = document.getElementById('chrono-time');
    const chronoReps = document.getElementById('chrono-reps');
    const startPauseBtn = document.getElementById('chrono-start-pause-btn');
    const resetBtn = document.getElementById('chrono-reset-btn');
    const closeBtn = document.getElementById('chrono-close-btn');

    // Áudios de voz
    const startSound = new Audio('iniciar.opus');
    const runSound = new Audio('correr.opus');
    const walkSound = new Audio('caminhar.opus');
    const finishSound = new Audio('finalizar.opus');

    // Estado do cronômetro
    let timerInterval = null;
    let currentWorkout = {};
    let activeCell = null;

    // --- FUNÇÃO DE PERSONALIZAÇÃO ---
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

    // --- LÓGICA DO CRONÔMETRO ---
    const parseWorkoutText = (text) => {
        const runMatch = text.match(/Corra (\d+) min/);
        const walkMatch = text.match(/caminhe (\d+) min/);
        const repsMatch = text.match(/repita (\d+)x/);
        if (text.includes('km')) { return { type: 'distance', description: text }; }
        const runTime = runMatch ? parseInt(runMatch[1], 10) * 60 : 0;
        const walkTime = walkMatch ? parseInt(walkMatch[1], 10) * 60 : 0;
        const reps = repsMatch ? parseInt(repsMatch[1], 10) : 1;
        return { type: 'interval', runTime, walkTime, totalReps: reps, currentRep: 1, isRunPhase: true, timeLeft: runTime, isPaused: true, };
    };
    const setupAndShowChrono = (cell) => {
        const workoutText = cell.textContent;
        currentWorkout = parseWorkoutText(workoutText);
        activeCell = cell;
        if (currentWorkout.type === 'distance') { alert(`Treino de hoje: ${currentWorkout.description}. Use um app de corrida para marcar a distância. Clique em 'OK' para marcar como concluído.`); cell.classList.add('completed'); saveProgress(); updateProgressCounter(); return; }
        resetChrono();
        chronoModal.classList.remove('hidden');
    };
    const updateChronoDisplay = () => {
        const minutes = Math.floor(currentWorkout.timeLeft / 60).toString().padStart(2, '0');
        const seconds = (currentWorkout.timeLeft % 60).toString().padStart(2, '0');
        chronoTime.textContent = `${minutes}:${seconds}`;
        if (currentWorkout.isRunPhase) { chronoStatus.textContent = "CORRA!"; } else { chronoStatus.textContent = "CAMINHE"; }
        chronoReps.textContent = `Repetições: ${currentWorkout.currentRep}/${currentWorkout.totalReps}`;
    };
    const timerTick = () => {
        if (currentWorkout.isPaused) return;
        currentWorkout.timeLeft--;
        updateChronoDisplay();
        if (currentWorkout.timeLeft < 0) {
            if (currentWorkout.isRunPhase && currentWorkout.walkTime > 0) { walkSound.play(); currentWorkout.isRunPhase = false; currentWorkout.timeLeft = currentWorkout.walkTime;
            } else {
                currentWorkout.currentRep++;
                if (currentWorkout.currentRep <= currentWorkout.totalReps) { runSound.play(); currentWorkout.isRunPhase = true; currentWorkout.timeLeft = currentWorkout.runTime;
                } else { finishWorkout(); }
            }
        }
    };
    const finishWorkout = () => {
        clearInterval(timerInterval);
        finishSound.play();
        chronoStatus.textContent = "TREINO CONCLUÍDO!";
        activeCell.classList.add('completed');
        saveProgress();
        updateProgressCounter();
        setTimeout(() => chronoModal.classList.add('hidden'), 2000);
    };
    const toggleStartPause = () => {
        currentWorkout.isPaused = !currentWorkout.isPaused;
        startPauseBtn.textContent = currentWorkout.isPaused ? 'Continuar' : 'Pausar';
        
        if (!currentWorkout.isPaused && !timerInterval) {
            // 1. Toca o som de início como antes
            startSound.play();
    
            // 2. "Destrava" os outros áudios para o navegador (a correção)
            // Toca, pausa e reinicia os outros sons para que o navegador os autorize.
            runSound.play(); runSound.pause(); runSound.currentTime = 0;
            walkSound.play(); walkSound.pause(); walkSound.currentTime = 0;
            finishSound.play(); finishSound.pause(); finishSound.currentTime = 0;
            
            // 3. Inicia o temporizador como antes
            timerInterval = setInterval(timerTick, 1000);
        }
    };
    const resetChrono = () => {
        clearInterval(timerInterval);
        timerInterval = null;
        currentWorkout.isRunPhase = true;
        currentWorkout.timeLeft = currentWorkout.runTime;
        currentWorkout.currentRep = 1;
        currentWorkout.isPaused = true;
        startPauseBtn.textContent = 'Iniciar';
        updateChronoDisplay();
    };
    const closeChrono = () => {
        clearInterval(timerInterval);
        timerInterval = null;
        chronoModal.classList.add('hidden');
    };
    trainingCells.forEach(cell => { cell.addEventListener('click', () => setupAndShowChrono(cell)); });
    startPauseBtn.addEventListener('click', toggleStartPause);
    resetBtn.addEventListener('click', resetChrono);
    closeBtn.addEventListener('click', closeChrono);

    // --- INICIALIZAÇÃO DA PÁGINA ---
    personalizeGreeting();
    loadProgress();
});