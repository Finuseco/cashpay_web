'use client';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { UserPlus } from 'lucide-react';

interface NetworkNode {
    userId: number;
    userName: string;
    profilePhoto?: string;
    mlmRank: string;
    level: number;
    leftChild?: NetworkNode;
    rightChild?: NetworkNode;
}

const NodeCard = ({ node }: { node: NetworkNode }) => (
    <div className="flex flex-col items-center">
        <div className="relative">
            <Avatar className="h-16 w-16 border-4 border-background bg-background shadow-md">
                <AvatarImage src={node.profilePhoto} />
                <AvatarFallback>{node.userName.slice(0, 2)}</AvatarFallback>
            </Avatar>
             <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs">{node.mlmRank}</Badge>
        </div>
        <p className="mt-3 text-sm font-semibold truncate">{node.userName}</p>
        <p className="text-xs text-muted-foreground">Niveau {node.level}</p>
    </div>
);

const EmptyNode = () => (
    <div className="flex flex-col items-center opacity-60">
        <div className="h-16 w-16 rounded-full bg-muted/50 border-2 border-dashed flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-muted-foreground"/>
        </div>
        <p className="mt-3 text-sm font-semibold text-muted-foreground">Position Vide</p>
    </div>
)

const TreeNode = ({ node }: { node?: NetworkNode }) => {
    if (!node) {
        return <EmptyNode />;
    }

    return (
        <div className="flex flex-col items-center relative pt-8">
            {/* Connector to parent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-8 w-px bg-muted-foreground"></div>
            
            <NodeCard node={node} />
            
            {(node.leftChild || node.rightChild) && (
                <div className="flex w-full pt-8 relative">
                    {/* Horizontal line */}
                    <div className="absolute top-0 left-1/4 right-1/4 h-px bg-muted-foreground"></div>

                    {/* Vertical line down to children */}
                    <div className="absolute top-0 left-1/4 -translate-x-1/2 h-8 w-px bg-muted-foreground"></div>
                    <div className="absolute top-0 right-1/4 translate-x-1/2 h-8 w-px bg-muted-foreground"></div>

                    <div className="w-1/2">
                        <TreeNode node={node.leftChild} />
                    </div>
                    <div className="w-1/2">
                        <TreeNode node={node.rightChild} />
                    </div>
                </div>
            )}
        </div>
    );
};


export function BinaryTreeView({ networkData }: { networkData: any }) {
    
    // Convert flat data from DB to a nested tree structure.
    // This is a simplified example. A real implementation would handle larger, more complex trees.
    const buildTree = (userId: number, allNodes: any[], level: number): NetworkNode | undefined => {
        const nodeData = allNodes.find(n => n.user_id === userId);
        if (!nodeData) return undefined;

        return {
            userId: nodeData.user_id,
            userName: nodeData.user_name,
            profilePhoto: nodeData.profile_photo,
            mlmRank: nodeData.mlm_rank,
            level: level,
            leftChild: buildTree(nodeData.left_child_id, allNodes, level + 1),
            rightChild: buildTree(nodeData.right_child_id, allNodes, level + 1)
        }
    }
    
    const rootNode = networkData ? buildTree(networkData[0].user_id, networkData, 0) : undefined;
    
    return (
        <Card className="p-4 overflow-x-auto bg-muted/50">
            <div className="min-w-max">
                <TreeNode node={rootNode} />
            </div>
        </Card>
    );
}
