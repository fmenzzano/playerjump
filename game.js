const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Configurações de velocidade
const INITIAL_SPEED = 3;  // Velocidade inicial mais alta
const SPEED_INCREASE = 0.001;  // Aumento gradual da velocidade
let currentSpeed = INITIAL_SPEED;

// Configurações de tamanho
const ELEMENT_SIZE = 42;  // Reduzido de 50 para 42 (redução de 15%)
const OBSTACLE_GAP = ELEMENT_SIZE * 3;  // Será automaticamente ajustado para 126 pixels

// Configurações do jogador
const player = {
    x: 150,
    y: canvas.height/2,
    width: ELEMENT_SIZE,    // Usar tamanho padrão
    height: ELEMENT_SIZE,   // Usar tamanho padrão
    gravity: 0.6,  // Aumentei a gravidade para tornar o jogo mais responsivo
    velocity: 0,
    jumpForce: -12  // Aumentei a força do pulo para compensar a gravidade
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
playerImg.src = 'fernandosemfundo.png';
const starImg = new Image();
starImg.src = 'marianasemfundo.png';

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
    const obstacle = {
        x: canvas.width,
        y: Math.random() * (canvas.height - OBSTACLE_GAP - 100) + 50,
        passed: false
    };
    obstacles.push(obstacle);
}

function update() {
    if (!gameStarted || gameOver) return;

    // Aumentar velocidade gradualmente
    currentSpeed += SPEED_INCREASE;

    // Atualizar posição do player
    player.velocity += player.gravity;
    player.y += player.velocity;

    // Verificar colisão com o chão e teto
    if (player.y > canvas.height - player.height) {
        player.y = canvas.height - player.height;
        player.velocity = player.jumpForce * 0.6; // Quicar com 60% da força do pulo
    }
    if (player.y < 0) {
        player.y = 0;
        player.velocity = 0;
    }

    // Atualizar obstáculos
    if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - 200) {
        createObstacle();
    }

    obstacles.forEach((obstacle, index) => {
        obstacle.x -= currentSpeed;

        // Verificar colisão com mais precisão usando os círculos
        const playerCenterX = player.x + ELEMENT_SIZE/2;
        const playerCenterY = player.y + ELEMENT_SIZE/2;
        const playerRadius = ELEMENT_SIZE/2;
        
        // Centro e raio da estrela superior
        const topStarCenterX = obstacle.x + ELEMENT_SIZE/2;
        const topStarCenterY = obstacle.y - ELEMENT_SIZE/2;
        const starRadius = ELEMENT_SIZE/2;
        
        // Centro da estrela inferior
        const bottomStarCenterX = obstacle.x + ELEMENT_SIZE/2;
        const bottomStarCenterY = obstacle.y + OBSTACLE_GAP + ELEMENT_SIZE/2;

        // Calcular distância exata entre os centros
        const distanceTopStar = Math.sqrt(
            Math.pow(playerCenterX - topStarCenterX, 2) + 
            Math.pow(playerCenterY - topStarCenterY, 2)
        );
        
        const distanceBottomStar = Math.sqrt(
            Math.pow(playerCenterX - bottomStarCenterX, 2) + 
            Math.pow(playerCenterY - bottomStarCenterY, 2)
        );
        
        // Colisão ocorre quando a soma dos raios é maior que a distância entre os centros
        const sumOfRadii = playerRadius + starRadius;
        if (distanceTopStar <= sumOfRadii || distanceBottomStar <= sumOfRadii) {
            if (!gameOver) {
                gameOver = true;
                if (score > 0) {
                    saveHighScore(score);
                }
            }
            return;
        }

        // Aumentar pontuação quando passar pelo par de estrelas
        if (!obstacle.passed && obstacle.x + ELEMENT_SIZE < player.x) {
            score++;  // Incrementa a pontuação ao passar pelo obstáculo
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
    
    // Título com efeito neon - ajustado
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.font = 'bold 48px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('Player Jump', canvas.width/2, canvas.height/2 - 40);
    
    // Textos com efeito futurista - ajustados
    ctx.shadowBlur = 5;
    ctx.font = '24px Orbitron';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Bem-vindo, ${playerName}!`, canvas.width/2, canvas.height/2);
    
    // Botão para editar nome
    drawNeonButton('EDITAR NOME', canvas.width/2, canvas.height/2 + 30);
    
    // Botão de início estilizado - ajustado (movido para baixo)
    drawNeonButton('PRESSIONE ESPAÇO PARA COMEÇAR', canvas.width/2, canvas.height/2 + 80);
    
    // Texto de instrução - ajustado e com mais espaço (movido para baixo)
    ctx.fillStyle = '#fff';
    ctx.fillText('Desvie da Mariana!', canvas.width/2, canvas.height/2 + 130);

    // Mostrar prompt de edição de nome se ainda não foi mostrado
    if (!hasShownNamePrompt && !isEditingName) {
        showEditNamePrompt();
    }
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
        const scores = await getGlobalScores();
        cachedScores = scores;
        return scores;
    } catch (error) {
        console.error('Erro ao buscar scores:', error);
        return [];
    }
}

function drawGameOver() {
    // Aplicar overlay cinza semi-transparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!showingRanking) {
        // Mostrar mensagem "SE FODEU"
        drawWastedText('SE FODEU', canvas.width/2, canvas.height/2, 70);
        
        // Instrução
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '18px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('Pressione ESPAÇO para ver o ranking', canvas.width/2, canvas.height/2 + 60);
        
        // Pré-carregar scores para a próxima tela
        fetchAndCacheScores();
    } else {
        // Mostrar ranking global
        drawRankingScreen();
    }
}

function drawRankingScreen() {
    // Background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    gradient.addColorStop(1, 'rgba(26, 26, 26, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Título
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Orbitron';  // Reduzido de 42px para 32px
    ctx.textAlign = 'center';
    ctx.fillText('RANKING GLOBAL', canvas.width/2, 80);  // Ajustado de 100 para 80
    
    // Sua pontuação
    ctx.font = '24px Orbitron';  // Reduzido de 28px para 24px
    ctx.fillText(`Sua pontuação: ${score} pts`, canvas.width/2, 130);  // Ajustado de 160 para 130
    
    // Título do TOP 3
    ctx.font = '20px Orbitron';  // Reduzido de 24px para 20px
    ctx.fillText('TOP 3 JOGADORES', canvas.width/2, 180);  // Ajustado de 220 para 180

    // Desenhar scores
    if (cachedScores) {
        cachedScores.forEach((highScore, index) => {
            const yPos = 220 + (index * 40);  // Reduzido de 50 para 40
            
            // Fundo da entrada (mais largo mas menos alto)
            ctx.fillStyle = highScore.name === playerName ? 
                'rgba(0, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(canvas.width/2 - 250, yPos - 20, 500, 35);  // Altura reduzida de 45 para 35
            
            // Badge (ajustado para nova altura)
            ctx.fillStyle = '#fff';
            ctx.font = '16px Orbitron';  // Reduzido de 18px para 16px
            const badge = drawFuturisticBadge(index + 1);
            ctx.textAlign = 'center';
            ctx.fillText(badge, canvas.width/2 - 180, yPos);
            
            // Nome
            const maxNameLength = 15;
            const displayName = highScore.name.length > maxNameLength ? 
                highScore.name.substring(0, maxNameLength) + '...' : 
                highScore.name;
            
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.fillText(displayName, canvas.width/2 - 120, yPos);
            
            // Pontuação
            ctx.fillStyle = '#0ff';
            ctx.textAlign = 'right';
            ctx.fillText(`${highScore.score} pts`, canvas.width/2 + 230, yPos);
        });
    } else {
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';  // Restaurar alinhamento central para mensagem de carregamento
        ctx.fillText('Carregando ranking...', canvas.width/2, 220);
    }

    // Restaurar alinhamento central para a instrução de reinício
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '18px Orbitron';
    ctx.fillText('PRESSIONE ESPAÇO PARA REINICIAR', canvas.width/2, canvas.height - 30);
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
        drawStartScreen();
        return;
    }

    // Jogo em andamento
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Desenhar player com contorno circular
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
        player.x + ELEMENT_SIZE/2,
        player.y + ELEMENT_SIZE/2,
        ELEMENT_SIZE/2,
        0,
        Math.PI * 2
    );
    ctx.stroke();
    ctx.drawImage(playerImg, player.x, player.y, ELEMENT_SIZE, ELEMENT_SIZE);
    ctx.restore();

    // Desenhar obstáculos com contorno circular
    obstacles.forEach(obstacle => {
        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        
        // Contorno e imagem superior
        ctx.beginPath();
        ctx.arc(
            obstacle.x + ELEMENT_SIZE/2,
            obstacle.y - ELEMENT_SIZE/2,
            ELEMENT_SIZE/2,
            0,
            Math.PI * 2
        );
        ctx.stroke();
        ctx.drawImage(starImg, obstacle.x, obstacle.y - ELEMENT_SIZE, ELEMENT_SIZE, ELEMENT_SIZE);
        
        // Contorno e imagem inferior
        ctx.beginPath();
        ctx.arc(
            obstacle.x + ELEMENT_SIZE/2,
            obstacle.y + OBSTACLE_GAP + ELEMENT_SIZE/2,
            ELEMENT_SIZE/2,
            0,
            Math.PI * 2
        );
        ctx.stroke();
        ctx.drawImage(starImg, obstacle.x, obstacle.y + OBSTACLE_GAP, ELEMENT_SIZE, ELEMENT_SIZE);
        
        ctx.restore();
    });

    // Desenhar pontuação
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#fff';
    ctx.font = '24px Orbitron';
    ctx.textAlign = 'left';
    ctx.fillText(`Pontuação: ${score}`, 10, 30);

    // Verificar game over por último
    if (gameOver) {
        drawGameOver();
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
    
    // Se o input estiver focado, permitir digitação
    if (document.activeElement === input) {
        return;
    }
    
    // Se o prompt estiver visível mas o input não estiver focado, 
    // prevenir teclas de afetar o jogo
    if (prompt.style.display === 'block') {
        event.preventDefault();
        return;
    }
    
    // Atalho para adicionar pontos (apenas durante o jogo)
    if (event.key.toLowerCase() === 'y' && gameStarted && !gameOver) {
        score += 10;
        return;
    }

    // Tecla espaço só funciona se o prompt não estiver visível
    if (event.code === 'Space') {
        if (gameOver) {
            if (!showingRanking) {
                // Primeiro espaço após game over mostra o ranking
                showingRanking = true;
            } else {
                // Segundo espaço reinicia o jogo
                gameOver = false;
                showingRanking = false;
                score = 0;
                distance = 0;
                currentSpeed = INITIAL_SPEED;
                obstacles.length = 0;
                player.y = canvas.height/2;
                player.velocity = 0;
            }
        }
        if (!prompt.style.display || prompt.style.display === 'none') {
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

document.addEventListener('touchstart', (event) => {
    event.preventDefault();
    
    if (gameOver) {
        if (!showingRanking) {
            showingRanking = true;
        } else {
            gameOver = false;
            showingRanking = false;
            score = 0;
            distance = 0;
            currentSpeed = INITIAL_SPEED;
            obstacles.length = 0;
            player.y = canvas.height/2;
            player.velocity = 0;
        }
        return;
    }
    
    if (!isEditingName) {
        jump();
    }
});

// Modificar a função showEditNamePrompt
function showEditNamePrompt() {
    const prompt = document.querySelector('.edit-name-prompt');
    const input = document.getElementById('nameInput');
    const gameContainer = document.querySelector('.game-container');
    
    // Adicionar blur ao fundo
    gameContainer.classList.add('blur');
    
    // Garantir que o input existe e está acessível
    if (!input) {
        console.error('Input não encontrado');
        return;
    }
    
    input.value = playerName;
    prompt.style.display = 'block';
    
    // Focar no input após um pequeno delay
    setTimeout(() => {
        input.focus();
    }, 100);
}

// Modificar a função handleNameInput
function handleNameInput() {
    const input = document.getElementById('nameInput');
    const prompt = document.querySelector('.edit-name-prompt');
    const gameContainer = document.querySelector('.game-container');
    const newName = input.value.trim();
    
    if (newName) {
        playerName = newName;
        localStorage.setItem('playerName', playerName);
    }
    
    prompt.style.display = 'none';
    gameContainer.classList.remove('blur');
    hasShownNamePrompt = true;
    
    // Reiniciar o estado do jogo
    gameStarted = false;
    gameOver = false;
    score = 0;
    obstacles.length = 0;
    player.y = canvas.height/2;
    player.velocity = 0;
}

// Modificar a função skipNameEdit
function skipNameEdit() {
    const prompt = document.querySelector('.edit-name-prompt');
    const gameContainer = document.querySelector('.game-container');
    
    prompt.style.display = 'none';
    gameContainer.classList.remove('blur');
    hasShownNamePrompt = true;
    
    // Reiniciar o estado do jogo
    gameStarted = false;
    gameOver = false;
    score = 0;
    obstacles.length = 0;
    player.y = canvas.height/2;
    player.velocity = 0;
}

// Remover o event listener handleInputKeypress que não é mais necessário
window.addEventListener('load', () => {
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

async function getGlobalScores() {
    try {
        const { data, error } = await supabaseClient
            .from('scores')
            .select('*')
            .order('score', { ascending: false })
            .limit(3);  // Limitando a 3 scores
        
        if (error) {
            console.error('Erro ao buscar scores:', error);
            throw error;
        }
        
        console.log('Dados recebidos:', data); // Debug
        return data || [];
    } catch (error) {
        console.error('Erro ao buscar pontuações:', error);
        return [];
    }
}

// Modificar a função saveHighScore para ser mais robusta
async function saveHighScore(score) {
    try {
        if (!playerName || playerName === 'undefined') return;
        
        // Salvar globalmente primeiro
        await saveGlobalScore(playerName, score);
        
        console.log('Score salvo com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar pontuação:', error);
    }
}

// Adicionar função para alternar entre ranking local e global
let isShowingGlobalRanking = false;

document.getElementById('toggleRanking').addEventListener('click', async () => {
    isShowingGlobalRanking = !isShowingGlobalRanking;
    const globalRanking = document.querySelector('.global-ranking');
    
    if (isShowingGlobalRanking) {
        const scores = await getGlobalScores();
        const rankingList = document.querySelector('.ranking-list');
        rankingList.innerHTML = scores.map((score, index) => `
            <div class="ranking-item">
                ${drawFuturisticBadge(index + 1)}
                ${score.name} - ${score.score} pts
                (${formatDate(score.date)})
            </div>
        `).join('');
        globalRanking.style.display = 'block';
    } else {
        globalRanking.style.display = 'none';
    }
});

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

// Modificar o event listener de clique
canvas.addEventListener('click', (event) => {
    if (!gameStarted && !gameOver && !isEditingName) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / canvasScale;
        const y = (event.clientY - rect.top) / canvasScale;
        
        if (isClickOnButton(x, y, canvas.height/2 + 30)) {
            showEditNamePrompt();
        }
    }
});

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
        
        const scores = await getGlobalScores();
        
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