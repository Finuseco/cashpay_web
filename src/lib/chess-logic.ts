

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
            const { board, turn } = this.fenToBoard(fen);
            this.board = board;
            this.turn = turn;
            this.moveHistory = []; // FEN doesn't contain history
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
        fen += ` ${this.turn[0]} KQkq - 0 1`; // Simplified FEN for this use case
        return fen;
    }

    getBestMove(level: number): { from: Position; to: Position } | null {
        const allPossibleMoves: { from: Position; to: Position; piece: ChessPiece }[] = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === this.turn) {
                    const validMoves = this.getValidMovesForPiece({ row: r, col: c });
                    for (const move of validMoves) {
                        allPossibleMoves.push({ from: { row: r, col: c }, to: move, piece });
                    }
                }
            }
        }

        if (allPossibleMoves.length === 0) return null;

        // Simple difficulty scaling
        if (level < 5) {
            // Low level: completely random move
            return allPossibleMoves[Math.floor(Math.random() * allPossibleMoves.length)];
        } else {
            // Higher level: prefer captures, otherwise random
            const capturingMoves = allPossibleMoves.filter(move => this.board[move.to.row][move.to.col] !== null);
            if (capturingMoves.length > 0) {
                return capturingMoves[Math.floor(Math.random() * capturingMoves.length)];
            }
            return allPossibleMoves[Math.floor(Math.random() * allPossibleMoves.length)];
        }
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

    private fenToBoard(fen: string): { board: Board; turn: PlayerColor } {
        const [boardPart, turnPart] = fen.split(' ');
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

        return { board, turn: turnPart === 'w' ? 'white' : 'black' };
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
