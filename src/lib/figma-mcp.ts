/**
 * Native Figma Minifier (Tokens Saver)
 * This module converts noisy, absolute-positioned Figma AST JSON
 * into an extremely compressed Pseudo-HTML string to save LLM tokens.
 */

function rgbToHex(color: { r: number, g: number, b: number, a?: number }) {
    if (!color) return "";
    const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
    const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
    const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
    if (color.a !== undefined && color.a < 1) {
        const a = Math.round(color.a * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}${a}`;
    }
    return `#${r}${g}${b}`;
}

export function parseFigmaNode(node: any): string {
    if (!node || node.visible === false) return "";

    let tag = node.type === 'FRAME' ? 'div' : node.type === 'TEXT' ? 'span' : 'div';
    let s: string[] = [];
    let content = "";

    if (node.type === 'TEXT') {
        content = (node.characters || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (node.style) {
            if (node.style.fontSize) s.push(`text:[${node.style.fontSize}px]`);
            if (node.style.fontWeight) s.push(`font-${node.style.fontWeight}`);
            if (node.style.textAlignHorizontal) s.push(`text-${node.style.textAlignHorizontal.toLowerCase()}`);
        }
    }

    if (node.fills?.length > 0) {
        const f = node.fills.find((f: any) => f.type === 'SOLID' && f.visible !== false);
        if (f?.color) {
            const hex = rgbToHex({...f.color, a: f.opacity});
            if (node.type === 'TEXT') s.push(`text-[${hex}]`);
            else s.push(`bg-[${hex}]`);
        }
    }

    if (node.cornerRadius) s.push(`rounded-[${node.cornerRadius}px]`);

    if (node.layoutMode && node.layoutMode !== 'NONE') {
        s.push('flex');
        s.push(node.layoutMode === 'HORIZONTAL' ? 'flex-row' : 'flex-col');
        if (node.itemSpacing) s.push(`gap-[${node.itemSpacing}px]`);
        if (node.paddingTop) s.push(`pt-[${node.paddingTop}px]`);
        if (node.paddingLeft) s.push(`pl-[${node.paddingLeft}px]`);
        
        const priMap: any = { 'MIN': 'justify-start', 'MAX': 'justify-end', 'CENTER': 'justify-center', 'SPACE_BETWEEN': 'justify-between' };
        const secMap: any = { 'MIN': 'items-start', 'MAX': 'items-end', 'CENTER': 'items-center' };
        if (node.primaryAxisAlignItems) s.push(priMap[node.primaryAxisAlignItems]);
        if (node.counterAxisAlignItems) s.push(secMap[node.counterAxisAlignItems]);
    }

    if (['VECTOR', 'STAR', 'ELLIPSE'].includes(node.type)) {
        s.push(`w-[${Math.round(node.absoluteBoundingBox?.width||24)}px] h-[${Math.round(node.absoluteBoundingBox?.height||24)}px]`);
        return `<Icon c="${s.join(' ')}"/>`;
    }

    let childrenHtml = "";
    if (node.children?.length > 0) {
        childrenHtml = node.children.map(parseFigmaNode).join('');
    }

    if (!s.length && !childrenHtml && !content) return "";

    const cAttr = s.length > 0 ? ` c="${s.join(' ')}"` : ``;
    return `<${tag}${cAttr}>${content}${childrenHtml}</${tag}>`;
}
