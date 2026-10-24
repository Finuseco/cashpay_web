

import type { Board, Position, ChessPiece, PieceType, PlayerColor } from './types';

export const getInitialBoard = (): Board => {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Pawns
  for (let i = 0; i < 8; i++) {
    board[1][i] = { type: 'pawn', color: 'black', symbol: '' };
    board[6][i] = { type: 'pawn', color: 'white', symbol: '' };
  }

  // Rooks
  board[0][0] = { type: 'rook', color: 'black', symbol: '' };
  board[0][7] = { type: 'rook', color: 'black', symbol: '' };
  board[7][0] = { type: 'rook', color: 'white', symbol: '' };
  board[7][7] = { type: 'rook', color: 'white', symbol: '' };

  // Knights
  board[0][1] = { type: 'knight', color: 'black', symbol: '' };
  board[0][6] = { type: 'knight', color: 'black', symbol: '' };
  board[7][1] = { type: 'knight', color: 'white', symbol: '' };
  board[7][6] = { type: 'knight', color: 'white', symbol: '' };
  
  // Bishops
  board[0][2] = { type: 'bishop', color: 'black', symbol: '' };
  board[0][5] = { type: 'bishop', color: 'black', symbol: '' };
  board[7][2] = { type: 'bishop', color: 'white', symbol: '' };
  board[7][5] = { type: 'bishop', color: 'white', symbol: '' };
  
  // Queens
  board[0][3] = { type: 'queen', color: 'black', symbol: '' };
  board[7][3] = { type: 'queen', color: 'white', symbol: '' };

  // Kings
  board[0][4] = { type: 'king', color: 'black', symbol: '' };
  board[7][4] = { type: 'king', color: 'white', symbol: '' };

  return board;
};


export class ChessLogic {
    board: Board;
    turn: PlayerColor;
    moveHistory: { from: Position, to: Position, piece: ChessPiece, notation: string }[];
    captured: { white: ChessPiece[], black: ChessPiece[] };

    constructor(logicToCopy?: ChessLogic, fen?: string) {
        if (logicToCopy) {
            this.board = logicToCopy.board.map(row => row.map(piece => piece ? {...piece} : null));
            this.turn = logicToCopy.turn;
            this.moveHistory = [...logicToCopy.moveHistory];
            this.captured = { white: [...logicToCopy.captured.white], black: [...logicToCopy.captured.black] };
        } else if (fen) {
            const { board, turn, enPassant } = this.fenToBoard(fen);
            this.board = board;
            this.turn = turn;
            this.moveHistory = [];
            if (enPassant) {
                // Reconstitue le dernier coup (avance de deux cases d'un pion) à partir de la case « en passant ».
                const col = 'abcdefgh'.indexOf(enPassant[0]);
                const rank = parseInt(enPassant[1], 10);
                const passedRow = 8 - rank;
                if (col >= 0 && (passedRow === 5 || passedRow === 2)) {
                    const color: PlayerColor = passedRow === 5 ? 'white' : 'black';
                    const fromRow = passedRow === 5 ? 6 : 1;
                    const toRow = passedRow === 5 ? 4 : 3;
                    this.moveHistory.push({
                        from: { row: fromRow, col }, to: { row: toRow, col },
                        piece: { type: 'pawn', color, symbol: '' }, notation: '',
                    });
                }
            }
            this.captured = { white: [], black: [] };
        } else {
            this.board = getInitialBoard();
            this.turn = 'white';
            this.moveHistory = [];
            this.captured = { white: [], black: [] };
        }
    }
    
    getFen(): string {
        let fen = '';
        for (let r = 0; r < 8; r++) {
            let emptyCount = 0;
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    fen += this.pieceToFenChar(piece);
                } else {
                    emptyCount++;
                }
            }
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            if (r < 7) {
                fen += '/';
            }
        }
        // Case « en passant » : nécessaire pour que le coup reste possible après resynchronisation par FEN.
        let enPassant = '-';
        const last = this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null;
        if (last && last.piece.type === 'pawn' && Math.abs(last.from.row - last.to.row) === 2) {
            const passedRow = (last.from.row + last.to.row) / 2;
            enPassant = `${'abcdefgh'[last.to.col]}${8 - passedRow}`;
        }
        fen += ` ${this.turn[0]} KQkq ${enPassant} 0 1`; // FEN simplifié (pas de roque géré)
        return fen;
    }

    private static PIECE_VALUE: Record<PieceType, number> = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 0 };

    /** Évaluation statique (du point de vue de `color`) : matériel + contrôle du centre + avancement des pions. */
    private evaluate(color: PlayerColor): number {
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (!p) continue;
                let v = ChessLogic.PIECE_VALUE[p.type];
                const centre = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5)); // 0..3
                if (p.type !== 'king' && p.type !== 'rook') v += centre * 6;
                if (p.type === 'pawn') v += (p.color === 'white' ? 6 - r : r - 1) * 4;
                score += p.color === color ? v : -v;
            }
        }
        return score;
    }

    private allLegalMoves(color: PlayerColor): { from: Position; to: Position }[] {
        const moves: { from: Position; to: Position }[] = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === color) {
                    for (const to of this.getValidMovesForPiece({ row: r, col: c })) moves.push({ from: { row: r, col: c }, to });
                }
            }
        }
        return moves;
    }

    private applyForSearch(m: { from: Position; to: Position }): ChessLogic {
        const next = new ChessLogic(this);
        const piece = next.board[m.from.row][m.from.col];
        const promote = piece && piece.type === 'pawn' && (m.to.row === 0 || m.to.row === 7) ? 'queen' : undefined;
        next.movePiece(m.from, m.to, promote);
        return next;
    }

    /**
     * Coup de l'ordinateur. Niveaux 1-3 : surtout aléatoire ; 4-6 : meilleur gain matériel immédiat ;
     * 7-10 : recherche sur 2 demi-coups (réponse de l'adversaire prise en compte), avec détection du mat.
     */
    getBestMove(level: number): { from: Position; to: Position } | null {
        const me = this.turn;
        const opp: PlayerColor = me === 'white' ? 'black' : 'white';
        const moves = this.allLegalMoves(me);
        if (moves.length === 0) return null;
        const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

        if (level <= 3 && Math.random() < 0.7) return pick(moves);

        let bestScore = -Infinity;
        let best: { from: Position; to: Position }[] = [];
        for (const m of moves) {
            const after = this.applyForSearch(m);
            let score: number;
            if (after.isCheckmate(opp)) {
                score = 100000;
            } else if (level >= 7) {
                const replies = after.allLegalMoves(opp);
                if (replies.length === 0) {
                    score = after.isCheck(opp) ? 100000 : 0; // mat / pat
                } else {
                    let worst = Infinity;
                    for (const reply of replies) {
                        const afterReply = after.applyForSearch(reply);
                        const s = afterReply.isCheckmate(me) ? -100000 : afterReply.evaluate(me);
                        if (s < worst) worst = s;
                    }
                    score = worst;
                }
            } else {
                score = after.evaluate(me) + (after.isCheck(opp) ? 15 : 0);
            }
            if (score > bestScore + 1e-9) { bestScore = score; best = [m]; }
            else if (Math.abs(score - bestScore) <= 1e-9) best.push(m);
        }
        return pick(best);
    }

    getValidMovesForPiece(pos: Position): Position[] {
        const piece = this.board[pos.row][pos.col];
        if (!piece) return [];

        let pseudoValidMoves: Position[] = [];
        switch (piece.type) {
            case 'pawn': pseudoValidMoves = this.getPawnMoves(pos, piece.color); break;
            case 'rook': pseudoValidMoves = this.getSlidingMoves(pos, piece.color, [{r:1,c:0}, {r:-1,c:0}, {r:0,c:1}, {r:0,c:-1}]); break;
            case 'knight': pseudoValidMoves = this.getKnightMoves(pos, piece.color); break;
            case 'bishop': pseudoValidMoves = this.getSlidingMoves(pos, piece.color, [{r:1,c:1}, {r:1,c:-1}, {r:-1,c:1}, {r:-1,c:-1}]); break;
            case 'queen': pseudoValidMoves = this.getSlidingMoves(pos, piece.color, [{r:1,c:0}, {r:-1,c:0}, {r:0,c:1}, {r:0,c:-1}, {r:1,c:1}, {r:1,c:-1}, {r:-1,c:1}, {r:-1,c:-1}]); break;
            case 'king': pseudoValidMoves = this.getKingMoves(pos, piece.color); break;
        }
        
        // Filter out moves that would leave the king in check
        return pseudoValidMoves.filter(move => {
            const tempLogic = new ChessLogic(this);
            tempLogic.movePiece(pos, move, undefined, true); // a "silent" move
            return !tempLogic.isCheck(piece.color);
        });
    }

    movePiece(from: Position, to: Position, promotionPieceType?: PieceType, isSilent = false) {
        const piece = this.board[from.row][from.col];
        if (!piece) return;
        
        const capturedPiece = this.board[to.row][to.col];

        // Handle en passant capture
        if (piece.type === 'pawn' && from.col !== to.col && !capturedPiece) {
            const capturedPawnPos = {row: from.row, col: to.col};
            this.captured[piece.color].push(this.board[capturedPawnPos.row][capturedPawnPos.col]!);
            this.board[capturedPawnPos.row][capturedPawnPos.col] = null;
        } else if (capturedPiece) {
             this.captured[piece.color].push(capturedPiece);
        }

        // Handle promotion
        if (promotionPieceType) {
            this.board[to.row][to.col] = { type: promotionPieceType, color: piece.color, symbol: '' };
        } else {
            this.board[to.row][to.col] = piece;
        }
        
        this.board[from.row][from.col] = null;
        
        if (!isSilent) {
            this.moveHistory.push({ from, to, piece: {...piece}, notation: this.moveToNotation(from, to, piece, !!capturedPiece) });
            this.turn = this.turn === 'white' ? 'black' : 'white';
        }
    }
    
    isCheck(playerColor: PlayerColor): boolean {
        const kingPos = this.findKing(playerColor);
        if (!kingPos) return true; // Should not happen

        const opponentColor = playerColor === 'white' ? 'black' : 'white';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === opponentColor) {
                    const moves = this.getPseudoLegalMoves(piece.type, {row: r, col: c}, piece.color);
                    if (moves.some(m => m.row === kingPos.row && m.col === kingPos.col)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    isCheckmate(playerColor: PlayerColor): boolean {
        if (!this.isCheck(playerColor)) return false;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === playerColor) {
                    if (this.getValidMovesForPiece({row: r, col: c}).length > 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    isStalemate(playerColor: PlayerColor): boolean {
        if (this.isCheck(playerColor)) return false;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === playerColor) {
                    if (this.getValidMovesForPiece({row: r, col: c}).length > 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    private fenToBoard(fen: string): { board: Board; turn: PlayerColor; enPassant: string | null } {
        const [boardPart, turnPart, , epPart] = fen.split(' ');
        const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
        const rows = boardPart.split('/');

        for (let r = 0; r < 8; r++) {
            let c = 0;
            for (const char of rows[r]) {
                if (isNaN(parseInt(char))) {
                    board[r][c] = this.fenCharToPiece(char);
                    c++;
                } else {
                    c += parseInt(char);
                }
            }
        }

        return { board, turn: turnPart === 'w' ? 'white' : 'black', enPassant: epPart && epPart !== '-' ? epPart : null };
    }

    private pieceToFenChar(piece: ChessPiece): string {
        let char = '';
        switch (piece.type) {
            case 'pawn': char = 'p'; break;
            case 'rook': char = 'r'; break;
            case 'knight': char = 'n'; break;
            case 'bishop': char = 'b'; break;
            case 'queen': char = 'q'; break;
            case 'king': char = 'k'; break;
        }
        return piece.color === 'white' ? char.toUpperCase() : char;
    }

    private fenCharToPiece(char: string): ChessPiece {
        const color = char === char.toUpperCase() ? 'white' : 'black';
        let type: PieceType;
        switch (char.toLowerCase()) {
            case 'p': type = 'pawn'; break;
            case 'r': type = 'rook'; break;
            case 'n': type = 'knight'; break;
            case 'b': type = 'bishop'; break;
            case 'q': type = 'queen'; break;
            case 'k': type = 'king'; break;
            default: throw new Error(`Invalid FEN char: ${char}`);
        }
        return { type, color, symbol: '' };
    }

    private findKing(color: PlayerColor): Position | null {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.type === 'king' && piece.color === color) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }

    private getPseudoLegalMoves(type: PieceType, pos: Position, color: PlayerColor): Position[] {
        switch (type) {
            case 'pawn': return this.getPawnMoves(pos, color);
            case 'rook': return this.getSlidingMoves(pos, color, [{r:1,c:0}, {r:-1,c:0}, {r:0,c:1}, {r:0,c:-1}]);
            case 'knight': return this.getKnightMoves(pos, color);
            case 'bishop': return this.getSlidingMoves(pos, color, [{r:1,c:1}, {r:1,c:-1}, {r:-1,c:1}, {r:-1,c:-1}]);
            case 'queen': return this.getSlidingMoves(pos, color, [{r:1,c:0}, {r:-1,c:0}, {r:0,c:1}, {r:0,c:-1}, {r:1,c:1}, {r:1,c:-1}, {r:-1,c:1}, {r:-1,c:-1}]);
            case 'king': return this.getKingMoves(pos, color);
            default: return [];
        }
    }
    
    // Movement logic for each piece type
    private getPawnMoves(pos: Position, color: PlayerColor): Position[] {
        const moves: Position[] = [];
        const dir = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;

        // 1-step forward
        const oneStep = { row: pos.row + dir, col: pos.col };
        if (this.isOnBoard(oneStep) && !this.board[oneStep.row][oneStep.col]) {
            moves.push(oneStep);
            
            // 2-step forward
            const twoStep = { row: pos.row + 2 * dir, col: pos.col };
            if (pos.row === startRow && !this.board[twoStep.row][twoStep.col]) {
                moves.push(twoStep);
            }
        }

        // Captures
        for (const dCol of [-1, 1]) {
            const capturePos = { row: pos.row + dir, col: pos.col + dCol };
            if (this.isOnBoard(capturePos) && this.isOpponent(capturePos, color)) {
                moves.push(capturePos);
            }
        }
        
        // En passant
        const lastMove = this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null;
        if (lastMove && lastMove.piece.type === 'pawn' && Math.abs(lastMove.from.row - lastMove.to.row) === 2) {
            const enPassantRow = color === 'white' ? 3 : 4;
            if (pos.row === enPassantRow && Math.abs(pos.col - lastMove.to.col) === 1) {
                const enPassantTarget = { row: pos.row + dir, col: lastMove.to.col };
                moves.push(enPassantTarget);
            }
        }

        return moves;
    }
    
    private getKnightMoves(pos: Position, color: PlayerColor): Position[] {
        const moves: Position[] = [];
        const directions = [
            {r: -2, c: -1}, {r: -2, c: 1}, {r: -1, c: -2}, {r: -1, c: 2},
            {r: 1, c: -2}, {r: 1, c: 2}, {r: 2, c: -1}, {r: 2, c: 1}
        ];
        for (const dir of directions) {
            const newPos = { row: pos.row + dir.r, col: pos.col + dir.c };
            if (this.isOnBoard(newPos) && !this.isFriendly(newPos, color)) {
                moves.push(newPos);
            }
        }
        return moves;
    }
    
    private getKingMoves(pos: Position, color: PlayerColor): Position[] {
        const moves: Position[] = [];
         for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newPos = { row: pos.row + dr, col: pos.col + dc };
                if (this.isOnBoard(newPos) && !this.isFriendly(newPos, color)) {
                    moves.push(newPos);
                }
            }
        }
        // TODO: Castling
        return moves;
    }

    private getSlidingMoves(pos: Position, color: PlayerColor, directions: {r: number, c: number}[]): Position[] {
        const moves: Position[] = [];
        for (const dir of directions) {
            let currentPos = { row: pos.row + dir.r, col: pos.col + dir.c };
            while (this.isOnBoard(currentPos)) {
                if (this.isFriendly(currentPos, color)) break;
                moves.push(currentPos);
                if (this.isOpponent(currentPos, color)) break;
                currentPos = { row: currentPos.row + dir.r, col: currentPos.col + dir.c };
            }
        }
        return moves;
    }

    private moveToNotation(from: Position, to: Position, piece: ChessPiece, isCapture: boolean): string {
        const files = 'abcdefgh';
        const ranks = '87654321';
        
        const pieceNotation = piece.type === 'pawn' ? '' : piece.type.charAt(0).toUpperCase();
        const captureNotation = isCapture ? 'x' : '';
        const fromNotation = `${files[from.col]}${ranks[from.row]}`;
        const toNotation = `${files[to.col]}${ranks[to.row]}`;

        return `${pieceNotation}${fromNotation}${captureNotation}${toNotation}`;
    }

    private isOnBoard(pos: Position): boolean {
        return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
    }
    private isFriendly(pos: Position, color: PlayerColor): boolean {
        const piece = this.board[pos.row][pos.col];
        return !!piece && piece.color === color;
    }
    private isOpponent(pos: Position, color: PlayerColor): boolean {
        const piece = this.board[pos.row][pos.col];
        return !!piece && piece.color !== color;
    }
}
