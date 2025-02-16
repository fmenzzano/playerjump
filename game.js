const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Adicionar no início do arquivo, após as outras constantes
const isAndroid = /Android/i.test(navigator.userAgent);

// Configurações de velocidade ajustadas por dispositivo
const INITIAL_SPEED = 4;
const SPEED_INCREASE = isAndroid ? 0.001 : 0.002;  // Metade da aceleração para Android
let currentSpeed = INITIAL_SPEED;

// Configurações de tamanho
const ELEMENT_SIZE = 62;  // Tamanho do elemento
const MIN_GAP = ELEMENT_SIZE * 1.5;  // Espaçamento vertical mínimo (93 pixels)

// Configurações do jogador ajustadas por dispositivo
const player = {
    x: 150,
    y: canvas.height/3,
    width: ELEMENT_SIZE,    
    height: ELEMENT_SIZE,   
    gravity: isAndroid ? 0.4 : 0.6,  // Gravidade reduzida para Android
    velocity: 0,
    jumpForce: isAndroid ? -5 : -6   // Força do pulo ajustada para Android
};

// Configurações dos obstáculos
const obstacles = [];  // Restaurar array de obstáculos

// Variáveis de estado do jogo
let score = 0;
let distance = 0;  // Nova variável para contar a distância
let gameOver = false;
let gameStarted = false;

// Adicionar nova variável de estado no início do arquivo
let showingRanking = false;

// Carregar imagens
const playerImg = new Image();
playerImg.src = 'navesemfundo.png';  // Mantém a nave como player
const starImg = new Image();
starImg.src = 'bolafogosemfundo.png';  // Alterado de asteroidsemfundo.png para bolafogosemfundo.png

// Adicionar no início do arquivo, após as variáveis existentes
const MAX_HIGH_SCORES = 3;
let highScores = JSON.parse(localStorage.getItem('highScores')) || [];
let playerName = localStorage.getItem('playerName') || 'Desconhecido';

// Adicionar variáveis para controle da edição de nome
let isEditingName = false;
let editingNameText = '';
let cursorVisible = true;
let lastCursorBlink = 0;

// Adicionar no início do arquivo, após as variáveis existentes
let canvasScale = 1;

// Adicionar no início do arquivo após as variáveis existentes
let hasShownNamePrompt = false;

// Modificar a inicialização do Supabase
const SUPABASE_URL = 'https://nomxwepvrfexggvhbqnp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbXh3ZXB2cmZleGdndmhicW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxMzM5MTQsImV4cCI6MjA1NDcwOTkxNH0.El9x92R-0i5dnNBMKkIr5svyUbSwjTg6ep7vx3mDpPY';

// Criar cliente Supabase (corrigir esta linha)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variável global para armazenar a posição
let playerPosition = '?';

// Adicionar variável para armazenar o total de jogadores
let totalUniquePlayers = 0;

// Adicionar variável para armazenar o total de tentativas
let totalAttempts = 0;

// Adicionar variável para controlar o tempo entre atualizações
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 2000; // 2 segundos entre atualizações

// Adicionar variáveis de controle de retry
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo

// Adicionar variáveis para controle do contador
let countdownActive = false;
let countdownTime = 3;
let lastCountdownUpdate = 0;

// Ajustar o intervalo da contagem
const COUNTDOWN_INTERVAL = 600; // Reduzido de 1000ms para 600ms

// Função para redimensionar o canvas
function resizeCanvas() {
    const container = document.querySelector('.game-container');
    const containerWidth = container.clientWidth - 20;
    const containerHeight = container.clientHeight - 20;
    
    // Calcular escala mantendo proporção 2:1
    const targetWidth = containerWidth;
    const targetHeight = containerWidth / 2;
    
    if (targetHeight > containerHeight) {
        canvasScale = containerHeight / canvas.height;
    } else {
        canvasScale = containerWidth / canvas.width;
    }
    
    canvas.style.width = (canvas.width * canvasScale) + 'px';
    canvas.style.height = (canvas.height * canvasScale) + 'px';

    // Mostrar mensagem de rotação apenas depois que o nome foi editado
    const rotateMessage = document.querySelector('.rotate-message');
    if (window.innerWidth < 500 && window.innerHeight > window.innerWidth && hasShownNamePrompt) {
        rotateMessage.style.display = 'flex';
        canvas.style.opacity = '0.3';  // Diminui a opacidade do jogo quando mostrar a mensagem
    } else {
        rotateMessage.style.display = 'none';
        canvas.style.opacity = '1';  // Restaura a opacidade normal
    }
}

function requestPlayerName() {
    const name = prompt('Digite seu nome:', playerName) || playerName;
    localStorage.setItem('playerName', name);
    playerName = name;
    return name;
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function jump() {
    if (!gameOver && gameStarted) {
        player.velocity = player.jumpForce;
    }
    if (!gameStarted) {
        gameStarted = true;
    }
}

function createObstacle() {
    // Calcular margens seguras considerando o tamanho do elemento e o gap
    const minY = ELEMENT_SIZE;  // Margem superior para o obstáculo superior
    const maxY = canvas.height - MIN_GAP - ELEMENT_SIZE;  // Margem inferior considerando gap mínimo
    
    // Adicionar aleatoriedade ao gap, mas manter no mínimo 1.5x o tamanho do elemento
    const randomGap = MIN_GAP + (Math.random() * ELEMENT_SIZE);  // Variação de até 1 elemento a mais
    
    const obstacle = {
        x: canvas.width,
        y: Math.random() * (maxY - minY) + minY,
        gap: randomGap,  // Cada obstáculo terá seu próprio gap
        passed: false
    };
    obstacles.push(obstacle);
}

// Adicionar função para verificar colisão por pixel
function checkPixelCollision(x1, y1, img1, x2, y2, img2) {
    // Reduzir a área de colisão para ser mais precisa
    const margin = 15;  // Aumentado de 10 para 15
    const sideMargin = 5;  // Margem menor para os lados
    
    const box1 = {
        left: x1 + sideMargin,
        right: x1 + ELEMENT_SIZE - sideMargin,
        top: y1 + margin,
        bottom: y1 + ELEMENT_SIZE - margin
    };
    
    const box2 = {
        left: x2 + sideMargin,
        right: x2 + ELEMENT_SIZE - sideMargin,
        top: y2 + margin,
        bottom: y2 + ELEMENT_SIZE - margin
    };

    // Verificar sobreposição de retângulos com prioridade para colisão lateral
    const isVerticalOverlap = box1.bottom > box2.top && box1.top < box2.bottom;
    const isHorizontalOverlap = box1.right > box2.left && box1.left < box2.right;
    
    // Só considerar colisão se houver sobreposição significativa
    return isVerticalOverlap && isHorizontalOverlap && 
           (box1.right - box2.left > ELEMENT_SIZE * 0.2);  // 20% de sobreposição mínima
}

// Modificar a função update para usar a nova detecção de colisão
function update() {
    if (!gameStarted || gameOver) return;

    // Aumentar velocidade gradualmente
    currentSpeed += SPEED_INCREASE;

    // Atualizar posição do player
    player.velocity += player.gravity;
    player.y += player.velocity;

    // Verificar colisão com o chão e teto
    if (player.y > canvas.height - player.height || player.y < 0) {
        gameOver = true;
        if (score > 0) {
            saveHighScore(score);
        }
        return;
    }

    // Atualizar obstáculos
    if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - (ELEMENT_SIZE * 3)) {
        createObstacle();
    }

    obstacles.forEach((obstacle, index) => {
        obstacle.x -= currentSpeed;

        // Verificar colisão com obstáculo superior
        if (checkPixelCollision(
            player.x, player.y, playerImg,
            obstacle.x, obstacle.y - ELEMENT_SIZE, starImg
        )) {
            gameOver = true;
            if (score > 0) saveHighScore(score);
            return;
        }

        // Verificar colisão com obstáculo inferior
        if (checkPixelCollision(
            player.x, player.y, playerImg,
            obstacle.x, obstacle.y + obstacle.gap, starImg
        )) {
            gameOver = true;
            if (score > 0) saveHighScore(score);
            return;
        }

        // Aumentar pontuação quando passar pelo obstáculo
        if (!obstacle.passed && obstacle.x + ELEMENT_SIZE < player.x) {
            score++;
            obstacle.passed = true;
        }

        // Remover obstáculos fora da tela
        if (obstacle.x + ELEMENT_SIZE < 0) {
            obstacles.splice(index, 1);
        }
    });
}

function drawStartScreen() {
    // Fundo gradiente
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Efeito de partículas
    drawParticles();
    
    // Se não tiver nome do jogador, solicitar
    if (!playerName) {
        playerName = requestPlayerName();
    }
    
    // Desenhar o player com efeito de brilho
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 10;
    ctx.drawImage(playerImg, 
        canvas.width/2 - player.width/2,
        canvas.height/2 - 160,
        player.width,
        player.height
    );
    ctx.restore();
    
    // Título com efeito neon
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.font = 'bold 48px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('Player Jump', canvas.width/2, canvas.height/2 - 40);
    
    // Textos com efeito futurista
    ctx.shadowBlur = 5;
    ctx.font = '24px Orbitron';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Bem-vindo, ${playerName}!`, canvas.width/2, canvas.height/2);
    
    // Botão para editar nome
    drawNeonButton('EDITAR NOME', canvas.width/2, canvas.height/2 + 30);
    
    // Botão de início estilizado
    drawNeonButton('PRESSIONE ESPAÇO PARA COMEÇAR', canvas.width/2, canvas.height/2 + 80);
    
    // Texto de instrução
    ctx.fillStyle = '#fff';
    ctx.fillText('Desvie dos obstáculos!', canvas.width/2, canvas.height/2 + 130);

    // Mostrar prompt de edição de nome se ainda não foi mostrado
    if (!hasShownNamePrompt && !isEditingName) {
        showEditNamePrompt();
    }

    document.getElementById('donation-button').style.display = 'none';
}

// Função para desenhar botão neon
function drawNeonButton(text, x, y) {
    const metrics = ctx.measureText(text);
    const padding = 20;
    const width = metrics.width + padding * 2;
    const height = 40;
    
    // Fundo do botão
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    
    // Desenhar retângulo arredondado
    ctx.beginPath();
    ctx.roundRect(x - width/2, y - height/2, width, height, 10);
    ctx.fill();
    ctx.stroke();
    
    // Texto do botão
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x, y + 8);
}

// Função para efeito de partículas
let particles = [];
function drawParticles() {
    // Criar novas partículas
    if (particles.length < 50) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 3,
            speedX: Math.random() * 2 - 1,
            speedY: Math.random() * 2 - 1
        });
    }
    
    // Atualizar e desenhar partículas
    particles.forEach((particle, index) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Remover partículas fora da tela
        if (particle.x < 0 || particle.x > canvas.width || 
            particle.y < 0 || particle.y > canvas.height) {
            particles.splice(index, 1);
            return;
        }
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function getPlayerPosition(currentScore) {
    // Criar uma lista temporária com todas as pontuações, incluindo a atual
    const allScores = [...highScores];
    if (currentScore > 0) {
        allScores.push({ score: currentScore, name: playerName });
    }
    
    // Ordenar todas as pontuações
    allScores.sort((a, b) => b.score - a.score);
    
    // Encontrar a posição do jogador atual
    return allScores.findIndex(hs => hs.score === currentScore && hs.name === playerName) + 1;
}

// Função para criar badge futurista
function drawFuturisticBadge(position) {
    switch(position) {
        case 1:
            return '【1st】';
        case 2:
            return '【2nd】';
        case 3:
            return '【3rd】';
        default:
            return `【${position}】`;
    }
}

// Adicionar função para desenhar texto com efeito de sombra
function drawWastedText(text, x, y, size) {
    ctx.save();
    
    // Sombra mais forte
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    
    // Texto em vermelho mais vibrante
    ctx.fillStyle = '#ff0000';
    ctx.font = `900 ${size}px Orbitron`;
    ctx.textAlign = 'center';
    
    // Desenhar várias vezes para efeito mais forte
    for(let i = 0; i < 3; i++) {
        ctx.fillText(text, x, y);
    }
    
    ctx.restore();
}

// Modificar a função drawGameOver para melhor gerenciamento de estado
let cachedScores = null;  // Cache para os scores

async function fetchAndCacheScores() {
    try {
        console.log('Buscando scores...');
        
        // Buscar top 10 usando uma query mais precisa
        const { data: scores, error } = await supabaseClient
            .rpc('get_top_10_scores');  // Vamos criar esta função no Supabase

        if (error) throw error;
        if (!scores) return cachedScores || [];

        // Atualizar cache
        cachedScores = scores;
        lastUpdateTime = Date.now();
        
        console.log('Scores carregados:', scores.length);
        return scores;
    } catch (error) {
        console.error('Erro ao buscar pontuações:', error);
        return cachedScores || [];
    }
}

function drawGameOver() {
    if (!showingRanking) {
        // Aplicar overlay semi-transparente
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Mostrar mensagem "SE FODEU"
        drawWastedText('SE FODEU', canvas.width/2, canvas.height/2, 70);
        
        // Instrução
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '18px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('Pressione ESPAÇO para ver o ranking', canvas.width/2, canvas.height/2 + 60);
        
        // Salvar pontuação se for maior que 0
        if (score > 0) {
            saveHighScore(score);
        }
    } else {
        drawRankingScreen();
    }
}

// Adicionar função para buscar posição do jogador no ranking
async function getPlayerRanking(playerName, currentScore) {
    try {
        // Buscar todas as pontuações maiores que a do jogador atual
        const { data, error } = await supabaseClient
            .from('scores')
            .select('score')
            .gt('score', currentScore)
            .order('score', { ascending: false });
            
        if (error) throw error;
        
        // A posição será o número de pontuações maiores + 1
        return (data?.length || 0) + 1;
    } catch (error) {
        console.error('Erro ao buscar posição:', error);
        return '?';
    }
}

function drawRankingScreen() {
    // Background mais escuro
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Título centralizado
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('RANKING GLOBAL', canvas.width/2, 40);
    
    // Sua pontuação e posição
    ctx.textAlign = 'center';
    ctx.font = '24px Orbitron';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Sua Posição: ${playerPosition}   |   Sua Pontuação: ${score} pts`, canvas.width/2, 70);

    // Atualizar a posição do jogador em background
    getPlayerRanking(playerName, score).then(pos => {
        playerPosition = pos;
    });
    
    // Desenhar scores
    if (!cachedScores || cachedScores.length === 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '18px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('Carregando ranking...', canvas.width/2, 220);
        
        fetchAndCacheScores();
    } else {
        // Top 3 com menos espaço
        cachedScores.slice(0, 3).forEach((highScore, index) => {
            const yPos = 100 + (index * 28);  // Reduzido de 30 para 28
            const rectHeight = 24;  // Reduzido de 25 para 24
            const rectY = yPos - rectHeight/2;
            const textY = yPos + 5;
            
            // Resto do código do top 3 igual
            ctx.fillStyle = highScore.name === playerName ? 
                'rgba(0, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(canvas.width/2 - 250, rectY, 500, rectHeight);
            
            ctx.fillStyle = '#fff';
            ctx.font = '18px Orbitron';
            const badge = drawFuturisticBadge(index + 1);
            ctx.textAlign = 'center';
            ctx.fillText(badge, canvas.width/2 - 180, textY);
            
            const maxNameLength = 15;
            const displayName = highScore.name.length > maxNameLength ? 
                highScore.name.substring(0, maxNameLength) + '...' : 
                highScore.name;
            
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.fillText(displayName, canvas.width/2 - 120, textY);
            
            ctx.fillStyle = '#0ff';
            ctx.textAlign = 'right';
            ctx.fillText(`${highScore.score} pts`, canvas.width/2 + 230, textY);
        });

        // Posições 4-10 mais compactas
        cachedScores.slice(3).forEach((highScore, index) => {
            const yPos = 185 + (index * 22);  // Começar mais próximo do top 3 e reduzir espaçamento
            
            ctx.fillStyle = highScore.name === playerName ? 
                'rgba(0, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(canvas.width/2 - 200, yPos - 10, 400, 20);  // Retângulo menor
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '14px Orbitron';
            const badge = drawFuturisticBadge(index + 4);
            ctx.textAlign = 'center';
            ctx.fillText(badge, canvas.width/2 - 150, yPos + 4);
            
            const maxNameLength = 15;
            const displayName = highScore.name.length > maxNameLength ? 
                highScore.name.substring(0, maxNameLength) + '...' : 
                highScore.name;
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.textAlign = 'left';
            ctx.fillText(displayName, canvas.width/2 - 100, yPos + 4);
            
            ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
            ctx.textAlign = 'right';
            ctx.fillText(`${highScore.score} pts`, canvas.width/2 + 180, yPos + 4);
        });
    }

    // Instrução para reiniciar
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '18px Orbitron';
    ctx.fillText('PRESSIONE ESPAÇO PARA REINICIAR', canvas.width/2, canvas.height - 20);

    // Mostrar botão de doação
    const donationButton = document.getElementById('donation-button');
    donationButton.style.display = 'block';
}

function draw() {
    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Desenhar fundo gradiente
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Desenhar partículas
    drawParticles();

    // Verificar edição de nome primeiro
    if (isEditingName) {
        drawNameEditor();
        return;
    }

    // Verificar se o jogo não começou
    if (!gameStarted) {
        if (countdownActive) {
            drawCountdown();
        } else {
            drawStartScreen();
        }
        return;
    }

    // Jogo em andamento
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Desenhar player (sem contorno)
    ctx.save();
    ctx.drawImage(playerImg, player.x, player.y, ELEMENT_SIZE, ELEMENT_SIZE);
    ctx.restore();

    // Desenhar obstáculos
    obstacles.forEach(obstacle => {
        ctx.save();
        
        // Imagem superior
        ctx.drawImage(starImg, obstacle.x, obstacle.y - ELEMENT_SIZE, ELEMENT_SIZE, ELEMENT_SIZE);
        
        // Imagem inferior (usando o gap específico do obstáculo)
        ctx.drawImage(starImg, obstacle.x, obstacle.y + obstacle.gap, ELEMENT_SIZE, ELEMENT_SIZE);
        
        ctx.restore();
    });

    // Desenhar pontuação com blur mais suave
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 2;  // Reduzido de 5 para 2
    ctx.fillStyle = '#fff';
    ctx.font = '24px Orbitron';
    ctx.textAlign = 'left';
    ctx.fillText(`Pontuação: ${score}`, 10, 30);

    // Verificar game over por último
    if (gameOver) {
        drawGameOver();
    }

    if (!showingRanking) {
        document.getElementById('donation-button').style.display = 'none';
    }
}

function gameLoop() {
    resizeCanvas(); // Chamar uma vez no início
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Modificar o event listener de keydown
document.addEventListener('keydown', (event) => {
    const prompt = document.querySelector('.edit-name-prompt');
    const input = document.getElementById('nameInput');
    
    if (document.activeElement === input) return;
    if (prompt.style.display === 'block') {
        event.preventDefault();
        return;
    }

    if (event.code === 'Space') {
        event.preventDefault();
        
        if (!gameStarted && !gameOver && !countdownActive) {
            startGame();
            return;
        }

        if (gameOver) {
            if (!showingRanking) {
                showingRanking = true;
                // Aguardar o salvamento da pontuação antes de mostrar o ranking
                if (score > 0) {
                    saveHighScore(score).then(() => {
                        fetchAndCacheScores();
                    });
                } else {
                    fetchAndCacheScores();
                }
            } else {
                resetGame();
            }
            return;
        }

        if (gameStarted && !gameOver) {
            jump();
        }
    }
});

// Adicionar event listener para o input
document.getElementById('nameInput').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        handleNameInput();
    }
});

// Adicionar event listener para os botões
document.querySelector('.save-button').addEventListener('click', handleNameInput);
document.querySelector('.skip-button').addEventListener('click', skipNameEdit);

// Otimizar o event listener de touch para Android
document.addEventListener('touchstart', (event) => {
    // Prevenir comportamentos padrão apenas se necessário
    if (event.target === canvas) {
        event.preventDefault();
        
        // Verificar se não está editando nome
        if (isEditingName) return;
        
        // Verificar se está no game over
        if (gameOver) {
            if (!showingRanking) {
                showingRanking = true;
            } else {
                resetGame();  // Função auxiliar para resetar o jogo
            }
            return;
        }
        
        // Executar pulo
        jump();
    }
}, { passive: true });  // Usar passive: true quando possível

// Função auxiliar para resetar o jogo
function resetGame() {
    // Resetar estados do jogo
    gameOver = false;
    showingRanking = false;
    score = 0;
    distance = 0;
    currentSpeed = INITIAL_SPEED;
    obstacles.length = 0;
    player.y = canvas.height/3;
    player.velocity = 0;

    // Iniciar contagem regressiva
    countdownActive = true;
    countdownTime = 3;
    lastCountdownUpdate = Date.now();
    gameStarted = false;
}

// Otimizar a prevenção de scroll
document.body.addEventListener('touchmove', (event) => {
    if (gameStarted && !gameOver && event.target === canvas) {
        event.preventDefault();
    }
}, { passive: false });

// Otimizar a detecção de toque no botão
function handleTouchStart(event) {
    if (!gameStarted && !gameOver && !isEditingName && !countdownActive) {
        const touch = event.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = (touch.clientX - rect.left) / canvasScale;
        const y = (touch.clientY - rect.top) / canvasScale;
        
        if (isClickOnButton(x, y, canvas.height/2 + 30)) {
            event.preventDefault();
            showEditNamePrompt();
        }
    }
}

// Adicionar o novo event listener
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });

// Modificar a função showEditNamePrompt
function showEditNamePrompt() {
    console.log('=== showEditNamePrompt iniciado ===');
    const prompt = document.querySelector('.edit-name-prompt');
    const input = document.getElementById('nameInput');
    const gameContainer = document.querySelector('.game-container');
    
    console.log('Estado do jogo antes do prompt:', {
        isEditingName,
        hasShownNamePrompt,
        gameStarted,
        gameOver,
        countdownActive
    });
    
    // Adicionar blur ao fundo
    gameContainer.classList.add('blur');
    
    // Garantir que o input existe e está acessível
    if (!input) {
        console.error('Input não encontrado');
        return;
    }
    
    // Resetar estados
    isEditingName = true;
    input.value = playerName === 'Desconhecido' ? '' : playerName;
    prompt.style.display = 'block';
    
    console.log('Prompt mostrado com sucesso');
    console.log('Input preenchido com:', input.value);
    
    // Focar no input após um pequeno delay
    setTimeout(() => {
        input.focus();
        input.select();
        console.log('Input focado e selecionado');
    }, 100);
    
    console.log('=== showEditNamePrompt finalizado ===');
}

// Modificar a função handleNameInput
function handleNameInput() {
    console.log('=== handleNameInput iniciado ===');
    const input = document.getElementById('nameInput');
    const prompt = document.querySelector('.edit-name-prompt');
    const newName = input.value.trim();
    
    console.log('Nome atual:', playerName);
    console.log('Novo nome:', newName);
    console.log('Estado do jogo:', {
        isEditingName,
        hasShownNamePrompt,
        gameStarted,
        gameOver,
        countdownActive
    });
    
    if (newName) {
        playerName = newName;
        localStorage.setItem('playerName', playerName);
        console.log('Nome salvo com sucesso:', playerName);
    }
    
    // Esconder prompt
    prompt.style.display = 'none';
    document.querySelector('.game-container').classList.remove('blur');
    
    // Resetar estados
    hasShownNamePrompt = true;
    isEditingName = false;
    
    console.log('Estados após salvar:', {
        isEditingName,
        hasShownNamePrompt,
        gameStarted,
        gameOver,
        countdownActive
    });
    console.log('=== handleNameInput finalizado ===');
}

// Modificar a função skipNameEdit para ser igualmente simples
function skipNameEdit() {
    const prompt = document.querySelector('.edit-name-prompt');
    
    // Esconder prompt
    prompt.style.display = 'none';
    document.querySelector('.game-container').classList.remove('blur');
    
    // Resetar estados
    hasShownNamePrompt = true;
    isEditingName = false;
}

// Modificar a forma como adicionamos os event listeners dos botões
function setupNameButtons() {
    // Remover event listeners antigos se existirem
    const saveButton = document.querySelector('.save-button');
    const skipButton = document.querySelector('.skip-button');
    
    // Limpar onclick inline
    saveButton.removeAttribute('onclick');
    skipButton.removeAttribute('onclick');
    
    // Adicionar novos event listeners
    saveButton.addEventListener('click', handleNameInput);
    skipButton.addEventListener('click', skipNameEdit);
}

// Chamar a função de setup quando o documento carregar
document.addEventListener('DOMContentLoaded', () => {
    setupNameButtons();
    
    // Iniciar o jogo
    gameLoop();
    
    // Se não tiver nome, mostrar o prompt
    if (!playerName || playerName === 'Desconhecido') {
        setTimeout(() => {
            showEditNamePrompt();
        }, 500);
    }
});

// Adicionar após as variáveis iniciais
function cleanUndefinedScores() {
    highScores = highScores.filter(score => score.name && score.name !== 'undefined');
    localStorage.setItem('highScores', JSON.stringify(highScores));
}

// Chamar a limpeza ao iniciar o jogo
cleanUndefinedScores();

// Funções para gerenciar ranking global
async function saveGlobalScore(name, score) {
    try {
        const { data, error } = await supabaseClient
            .from('scores')
            .insert([{ 
                name: name, 
                score: score
            }]);
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao salvar pontuação:', error);
    }
}

// Adicionar função para verificar clique no botão
function isClickOnButton(x, y, buttonY) {
    const metrics = ctx.measureText('EDITAR NOME');
    const padding = 20;
    const width = metrics.width + padding * 2;
    const height = 40;
    
    // Aumentar a área de toque em dispositivos móveis
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const touchPadding = isMobile ? 20 : 0;
    
    return x > (canvas.width/2 - width/2 - touchPadding) &&
           x < (canvas.width/2 + width/2 + touchPadding) &&
           y > (buttonY - height/2 - touchPadding) &&
           y < (buttonY + height/2 + touchPadding);
}

// Modificar a função requestPlayerName
function startEditingName() {
    isEditingName = true;
    editingNameText = playerName;
}

// Adicionar função para desenhar a interface de edição de nome
function drawNameEditor() {
    // Fundo semi-transparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Título
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.font = 'bold 32px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('EDITAR NOME', canvas.width/2, canvas.height/2 - 60);

    // Campo de texto
    const padding = 20;
    const boxWidth = 300;
    const boxHeight = 40;
    const boxX = canvas.width/2 - boxWidth/2;
    const boxY = canvas.height/2 - boxHeight/2;

    // Desenhar caixa de texto
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 5);
    ctx.fill();
    ctx.stroke();

    // Texto sendo editado
    ctx.fillStyle = '#fff';
    ctx.font = '24px Orbitron';
    ctx.textAlign = 'left';
    
    // Cursor piscante (pisca a cada 500ms)
    if (Date.now() - lastCursorBlink > 500) {
        cursorVisible = !cursorVisible;
        lastCursorBlink = Date.now();
    }
    
    const displayText = editingNameText + (cursorVisible ? '|' : '');
    ctx.fillText(displayText, boxX + 10, boxY + 28);

    // Instruções
    ctx.font = '18px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('Pressione ENTER para salvar ou ESC para cancelar', canvas.width/2, canvas.height/2 + 50);
}

// Adicionar event listener para redimensionamento
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

// Adicionar prevenção de zoom em dispositivos móveis
document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });

// Desabilitar duplo toque para zoom
document.addEventListener('dblclick', (event) => {
    event.preventDefault();
});

// Adicionar listener para ajustar o prompt quando a orientação mudar
window.addEventListener('orientationchange', () => {
    adjustEditPromptForMobile();
});

// Melhorar a função que mostra o ranking global
async function showGlobalRanking() {
    const globalRanking = document.querySelector('.global-ranking');
    const rankingList = document.querySelector('.ranking-list');
    
    try {
        // Mostrar loading
        rankingList.innerHTML = '<div class="loading">Carregando ranking...</div>';
        globalRanking.style.display = 'block';
        
        const scores = await fetchAndCacheScores();
        
        if (scores.length === 0) {
            rankingList.innerHTML = '<div class="no-scores">Nenhuma pontuação registrada ainda</div>';
            return;
        }

        rankingList.innerHTML = scores.map((score, index) => `
            <div class="ranking-item ${score.name === playerName ? 'current-player' : ''}">
                <span class="position">${drawFuturisticBadge(index + 1)}</span>
                <span class="player-name">${score.name}</span>
                <span class="score">${score.score} pts</span>
                <span class="date">${formatDate(score.date)}</span>
            </div>
        `).join('');
    } catch (error) {
        rankingList.innerHTML = '<div class="error">Erro ao carregar ranking</div>';
        console.error('Erro ao mostrar ranking:', error);
    }
}

// Adicionar as funções de doação
function showDonationQR() {
    const modal = document.getElementById('donation-modal');
    modal.style.display = 'flex';
}

// Adicionar event listeners para o modal de doação
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('donation-modal');
    const closeBtn = document.querySelector('.close-donation');

    // Fechar ao clicar no X
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Fechar ao clicar fora do modal
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
});

// Adicionar função para salvar pontuação
async function saveHighScore(score) {
    try {
        const { data, error } = await supabaseClient
            .from('scores')
            .insert([
                {
                    name: playerName,
                    score: score
                }
            ]);

        if (error) throw error;

        // Forçar atualização do cache após salvar nova pontuação
        cachedScores = null;
        
        // Buscar scores atualizados
        await fetchAndCacheScores();

        // Atualizar posição do jogador
        getPlayerRanking(playerName, score).then(pos => {
            playerPosition = pos;
        });

        return data;
    } catch (error) {
        console.error('Erro ao salvar pontuação:', error);
    }
}

// Modificar o event listener do mouse
canvas.addEventListener('mousedown', (event) => {
    // Prevenir comportamentos padrão
    event.preventDefault();
    
    // Verificar se está no prompt de nome
    const prompt = document.querySelector('.edit-name-prompt');
    if (prompt.style.display === 'block' || isEditingName) {
        return;
    }
    
    // Se o jogo não começou, iniciar
    if (!gameStarted && !gameOver && !countdownActive) {
        startGame();
        return;
    }
    
    // Se estiver em game over
    if (gameOver) {
        if (!showingRanking) {
            showingRanking = true;
            if (score > 0) {
                saveHighScore(score).then(() => {
                    fetchAndCacheScores();
                });
            } else {
                fetchAndCacheScores();
            }
        } else {
            resetGame();
        }
        return;
    }
    
    // Se o jogo está em andamento, pular
    if (gameStarted && !gameOver) {
        jump();
    }
});

// Opcional: Adicionar também suporte para botão direito do mouse
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault(); // Prevenir menu de contexto
});

// Modificar a função de início do jogo
function startGame() {
    if (!countdownActive && !gameStarted) {
        countdownActive = true;
        countdownTime = 3;
        lastCountdownUpdate = Date.now();
        gameStarted = false;  // Garantir que o jogo só começa após a contagem
    }
}

// Adicionar função para desenhar o contador
function drawCountdown() {
    // Desenhar o jogo normalmente no fundo
    drawGameBackground();
    drawParticles();
    
    // Desenhar player
    ctx.save();
    ctx.drawImage(playerImg, player.x, player.y, ELEMENT_SIZE, ELEMENT_SIZE);
    ctx.restore();

    // Desenhar obstáculos existentes
    obstacles.forEach(obstacle => {
        ctx.save();
        ctx.drawImage(starImg, obstacle.x, obstacle.y - ELEMENT_SIZE, ELEMENT_SIZE, ELEMENT_SIZE);
        ctx.drawImage(starImg, obstacle.x, obstacle.y + obstacle.gap, ELEMENT_SIZE, ELEMENT_SIZE);
        ctx.restore();
    });

    // Verificar tempo para atualizar contador
    const now = Date.now();
    if (now - lastCountdownUpdate >= COUNTDOWN_INTERVAL) {
        countdownTime--;
        lastCountdownUpdate = now;
        
        if (countdownTime < 0) {
            countdownActive = false;
            gameStarted = true;
            return;
        }
    }

    // Adicionar overlay semi-transparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Desenhar o número ou "GO!"
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (countdownTime === 0) {
        // Desenhar "GO!" com mais destaque
        ctx.font = 'bold 100px Orbitron';
        ctx.fillStyle = '#0f0';
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 30;
        ctx.fillText('GO!', canvas.width/2, canvas.height/2);
        
        // Adicionar brilho extra
        ctx.globalAlpha = 0.5;
        ctx.fillText('GO!', canvas.width/2, canvas.height/2);
    } else {
        // Desenhar número com mais destaque
        ctx.font = 'bold 120px Orbitron';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 30;
        ctx.fillText(countdownTime, canvas.width/2, canvas.height/2);
        
        // Adicionar brilho extra
        ctx.globalAlpha = 0.5;
        ctx.fillText(countdownTime, canvas.width/2, canvas.height/2);
    }
    ctx.restore();
}

// Função auxiliar para desenhar o fundo do jogo
function drawGameBackground() {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Adicionar event listener para redimensionamento
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

// Adicionar prevenção de zoom em dispositivos móveis
document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });

// Desabilitar duplo toque para zoom
document.addEventListener('dblclick', (event) => {
    event.preventDefault();
});

// Adicionar listener para ajustar o prompt quando a orientação mudar
window.addEventListener('orientationchange', () => {
    adjustEditPromptForMobile();
});

// Melhorar a função que mostra o ranking global
async function showGlobalRanking() {
    const globalRanking = document.querySelector('.global-ranking');
    const rankingList = document.querySelector('.ranking-list');
    
    try {
        // Mostrar loading
        rankingList.innerHTML = '<div class="loading">Carregando ranking...</div>';
        globalRanking.style.display = 'block';
        
        const scores = await fetchAndCacheScores();
        
        if (scores.length === 0) {
            rankingList.innerHTML = '<div class="no-scores">Nenhuma pontuação registrada ainda</div>';
            return;
        }

        rankingList.innerHTML = scores.map((score, index) => `
            <div class="ranking-item ${score.name === playerName ? 'current-player' : ''}">
                <span class="position">${drawFuturisticBadge(index + 1)}</span>
                <span class="player-name">${score.name}</span>
                <span class="score">${score.score} pts</span>
                <span class="date">${formatDate(score.date)}</span>
            </div>
        `).join('');
    } catch (error) {
        rankingList.innerHTML = '<div class="error">Erro ao carregar ranking</div>';
        console.error('Erro ao mostrar ranking:', error);
    }
}

// Adicionar as funções de doação
function showDonationQR() {
    const modal = document.getElementById('donation-modal');
    modal.style.display = 'flex';
}

// Adicionar event listeners para o modal de doação
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('donation-modal');
    const closeBtn = document.querySelector('.close-donation');

    // Fechar ao clicar no X
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Fechar ao clicar fora do modal
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
});

// Adicionar função para salvar pontuação
async function saveHighScore(score) {
    try {
        const { data, error } = await supabaseClient
            .from('scores')
            .insert([
                {
                    name: playerName,
                    score: score
                }
            ]);

        if (error) throw error;

        // Forçar atualização do cache após salvar nova pontuação
        cachedScores = null;
        
        // Buscar scores atualizados
        await fetchAndCacheScores();

        // Atualizar posição do jogador
        getPlayerRanking(playerName, score).then(pos => {
            playerPosition = pos;
        });

        return data;
    } catch (error) {
        console.error('Erro ao salvar pontuação:', error);
    }
}

// Modificar o event listener do mouse
canvas.addEventListener('mousedown', (event) => {
    // Prevenir comportamentos padrão
    event.preventDefault();
    
    // Verificar se está no prompt de nome
    const prompt = document.querySelector('.edit-name-prompt');
    if (prompt.style.display === 'block' || isEditingName) {
        return;
    }
    
    // Se o jogo não começou, iniciar
    if (!gameStarted && !gameOver && !countdownActive) {
        startGame();
        return;
    }
    
    // Se estiver em game over
    if (gameOver) {
        if (!showingRanking) {
            showingRanking = true;
            if (score > 0) {
                saveHighScore(score).then(() => {
                    fetchAndCacheScores();
                });
            } else {
                fetchAndCacheScores();
            }
        } else {
            resetGame();
        }
        return;
    }
    
    // Se o jogo está em andamento, pular
    if (gameStarted && !gameOver) {
        jump();
    }
});

// Opcional: Adicionar também suporte para botão direito do mouse
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault(); // Prevenir menu de contexto
}); 