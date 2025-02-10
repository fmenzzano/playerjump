const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Configurações de velocidade
const INITIAL_SPEED = 4;  // Reduzido de 5 para 4
const SPEED_INCREASE = 0.002;  // Mantido o mesmo aumento gradual
let currentSpeed = INITIAL_SPEED;

// Configurações de tamanho
const ELEMENT_SIZE = 62;  // Tamanho do elemento
const MIN_GAP = ELEMENT_SIZE * 1.5;  // Espaçamento vertical mínimo (93 pixels)

// Configurações do jogador
const player = {
    x: 150,
    y: canvas.height/2,
    width: ELEMENT_SIZE,    
    height: ELEMENT_SIZE,   
    gravity: 0.6,          
    velocity: 0,
    jumpForce: -6          // Reduzido de -8 para -6 para um pulo menor
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
    // Aplicar overlay cinza semi-transparente mais suave
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';  // Reduzido de 0.5 para 0.3
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
    // Background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(26, 26, 26, 0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Título ainda mais para cima
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('RANKING GLOBAL', canvas.width/2, 40);
    
    // Sua pontuação e posição
    ctx.font = '24px Orbitron';
    ctx.fillText(`Sua Posição: ${playerPosition}   |   Sua Pontuação: ${score} pts`, canvas.width/2, 70);
    
    // Atualizar a posição do jogador em background
    getPlayerRanking(playerName, score).then(pos => {
        playerPosition = pos;
    });
    
    // Desenhar scores
    if (cachedScores) {
        // Top 3 começa mais acima
        cachedScores.slice(0, 3).forEach((highScore, index) => {
            const yPos = 110 + (index * 30);  // Reduzido de 120 para 110 e de 32 para 30
            const rectHeight = 25;
            const rectY = yPos - rectHeight/2;
            const textY = yPos + 5;
            
            // Fundo com destaque para top 3 (altura menor)
            ctx.fillStyle = highScore.name === playerName ? 
                'rgba(0, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(canvas.width/2 - 250, rectY, 500, rectHeight);
            
            // Badge com destaque (fonte menor)
            ctx.fillStyle = '#fff';
            ctx.font = '18px Orbitron';
            const badge = drawFuturisticBadge(index + 1);
            ctx.textAlign = 'center';
            ctx.fillText(badge, canvas.width/2 - 180, textY);
            
            // Nome e pontuação com destaque
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

        // Posições 4-10 começam mais acima e mais compactas
        cachedScores.slice(3, 10).forEach((highScore, index) => {
            const yPos = 210 + (index * 23);  // Reduzido de 220 para 210 e de 25 para 23
            
            // Fundo mais sutil
            ctx.fillStyle = highScore.name === playerName ? 
                'rgba(0, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(canvas.width/2 - 200, yPos - 15, 400, 25);
            
            // Badge menor
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '14px Orbitron';
            const badge = drawFuturisticBadge(index + 4);
            ctx.textAlign = 'center';
            ctx.fillText(badge, canvas.width/2 - 150, yPos);
            
            // Nome e pontuação menores
            const maxNameLength = 15;
            const displayName = highScore.name.length > maxNameLength ? 
                highScore.name.substring(0, maxNameLength) + '...' : 
                highScore.name;
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.textAlign = 'left';
            ctx.fillText(displayName, canvas.width/2 - 100, yPos);
            
            ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
            ctx.textAlign = 'right';
            ctx.fillText(`${highScore.score} pts`, canvas.width/2 + 180, yPos);
        });
    } else {
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('Carregando ranking...', canvas.width/2, 220);
    }

    // Instrução para reiniciar mais abaixo e centralizada
    ctx.textAlign = 'center';  // Garantir alinhamento central
    ctx.fillStyle = '#fff';
    ctx.font = '18px Orbitron';  // Definir fonte antes de desenhar
    ctx.fillText('PRESSIONE ESPAÇO PARA REINICIAR', canvas.width/2, canvas.height - 20);
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
    gameOver = false;
    showingRanking = false;
    score = 0;
    currentSpeed = INITIAL_SPEED;
    obstacles.length = 0;
    player.y = canvas.height/2;
    player.velocity = 0;
}

// Otimizar a prevenção de scroll
document.body.addEventListener('touchmove', (event) => {
    if (gameStarted && !gameOver && event.target === canvas) {
        event.preventDefault();
    }
}, { passive: false });

// Otimizar a detecção de toque no botão
function handleTouchStart(event) {
    if (!gameStarted && !gameOver && !isEditingName) {
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
    
    // Resetar estados
    isEditingName = true;
    input.value = playerName === 'Desconhecido' ? '' : playerName;
    prompt.style.display = 'block';
    
    // Focar no input após um pequeno delay e selecionar todo o texto
    setTimeout(() => {
        input.focus();
        input.select();
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
    isEditingName = false;  // Resetar estado de edição
    
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
    isEditingName = false;  // Resetar estado de edição
    
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
            .limit(10);  // Alterado de 3 para 10
        
        if (error) throw error;
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

// Otimizar o cache do ranking
let lastRankingUpdate = 0;
const RANKING_UPDATE_INTERVAL = 2000;  // Atualizar a cada 2 segundos

function updateRankingIfNeeded() {
    const now = Date.now();
    if (now - lastRankingUpdate > RANKING_UPDATE_INTERVAL) {
        fetchAndCacheScores();
        lastRankingUpdate = now;
    }
} 