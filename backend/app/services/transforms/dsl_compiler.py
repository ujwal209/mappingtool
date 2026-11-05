"""
Safe DSL for custom transforms.

Users define custom transforms via expressions like:

    "upper(trim(source[0]))"
    "concat(source[0], ' ', source[1])"
    "if_null(source[0], 'N/A')"
    "replace(source[0], '-', '/')"

This module compiles those expressions into a Python callable via a
hand-written recursive-descent parser — NOT `eval()` — so an attacker
cannot execute arbitrary code even if they somehow bypass our AST
allowlist.
"""

import re
from typing import Any, Callable, Dict, List, Optional


# ═══════════════════════════════════════════════════════════════
# Safe function library (allowlist)
# ═══════════════════════════════════════════════════════════════
def _fn_upper(v):
    return str(v).upper() if v is not None else None


def _fn_lower(v):
    return str(v).lower() if v is not None else None


def _fn_trim(v):
    return str(v).strip() if v is not None else None


def _fn_concat(*args):
    return "".join(str(a) for a in args if a is not None)


def _fn_if_null(v, default):
    return v if v is not None else default


def _fn_replace(v, find, repl):
    if v is None:
        return None
    return str(v).replace(str(find), str(repl))


def _fn_substr(v, start, length=None):
    if v is None:
        return None
    s = str(v)
    if length is None:
        return s[int(start):]
    return s[int(start):int(start) + int(length)]


def _fn_round(v, decimals=0):
    try:
        return round(float(v), int(decimals))
    except (TypeError, ValueError):
        return None


def _fn_len(v):
    return len(str(v)) if v is not None else 0


def _fn_hash(v):
    import hashlib
    if v is None:
        return None
    return hashlib.sha256(str(v).encode()).hexdigest()


SAFE_FUNCTIONS: Dict[str, Callable] = {
    "upper": _fn_upper,
    "lower": _fn_lower,
    "trim": _fn_trim,
    "concat": _fn_concat,
    "if_null": _fn_if_null,
    "replace": _fn_replace,
    "substr": _fn_substr,
    "round": _fn_round,
    "len": _fn_len,
    "hash": _fn_hash,
    "source": lambda idx: None,  # resolved at runtime
}


# ═══════════════════════════════════════════════════════════════
# Tokenizer
# ═══════════════════════════════════════════════════════════════
_TOKEN_RE = re.compile(
    r"""
    (?P<ident>[a-zA-Z_][a-zA-Z0-9_]*)
  | (?P<number>-?\d+(?:\.\d+)?)
  | (?P<string>'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")
  | (?P<lbracket>\[)
  | (?P<rbracket>\])
  | (?P<lparen>\()
  | (?P<rparen>\))
  | (?P<comma>,)
  | (?P<ws>\s+)
    """,
    re.VERBOSE,
)


class Token:
    def __init__(self, kind: str, value: Any):
        self.kind = kind
        self.value = value

    def __repr__(self):
        return f"Token({self.kind}, {self.value!r})"


def _tokenize(expr: str) -> List[Token]:
    tokens: List[Token] = []
    pos = 0
    while pos < len(expr):
        m = _TOKEN_RE.match(expr, pos)
        if not m:
            raise ValueError(
                f"Unexpected character at position {pos}: '{expr[pos]}'"
            )
        kind = m.lastgroup
        value = m.group()
        pos = m.end()
        if kind == "ws":
            continue
        if kind == "string":
            # Strip quotes and unescape
            inner = value[1:-1]
            inner = inner.replace("\\'", "'").replace('\\"', '"')
            tokens.append(Token("string", inner))
        elif kind == "number":
            tokens.append(Token("number", float(value) if "." in value else int(value)))
        else:
            tokens.append(Token(kind, value))
    return tokens


# ═══════════════════════════════════════════════════════════════
# Recursive descent parser → AST
# ═══════════════════════════════════════════════════════════════
class Node:
    pass


class LiteralNode(Node):
    def __init__(self, value):
        self.value = value


class SourceIndexNode(Node):
    def __init__(self, index):
        self.index = index


class CallNode(Node):
    def __init__(self, name: str, args: List[Node]):
        self.name = name
        self.args = args


class _Parser:
    def __init__(self, tokens: List[Token]):
        self.tokens = tokens
        self.pos = 0

    def peek(self) -> Optional[Token]:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def consume(self, kind: str) -> Token:
        tok = self.peek()
        if not tok or tok.kind != kind:
            raise ValueError(f"Expected {kind}, got {tok.kind if tok else 'EOF'}")
        self.pos += 1
        return tok

    def parse_expr(self) -> Node:
        tok = self.peek()
        if not tok:
            raise ValueError("Unexpected end of expression")

        if tok.kind in ("string", "number"):
            self.pos += 1
            return LiteralNode(tok.value)

        if tok.kind == "ident":
            name = tok.value
            self.pos += 1

            # source[N] special case
            if name == "source":
                self.consume("lbracket")
                idx_tok = self.consume("number")
                self.consume("rbracket")
                return SourceIndexNode(int(idx_tok.value))

            # Function call
            self.consume("lparen")
            args: List[Node] = []
            if self.peek() and self.peek().kind != "rparen":
                args.append(self.parse_expr())
                while self.peek() and self.peek().kind == "comma":
                    self.pos += 1
                    args.append(self.parse_expr())
            self.consume("rparen")
            return CallNode(name, args)

        raise ValueError(f"Unexpected token: {tok.kind}")

    def parse(self) -> Node:
        node = self.parse_expr()
        if self.pos < len(self.tokens):
            raise ValueError(
                f"Trailing tokens after expression: {self.tokens[self.pos:]}"
            )
        return node


# ═══════════════════════════════════════════════════════════════
# Compiler — AST → Python callable
# ═══════════════════════════════════════════════════════════════
def _compile_node(node: Node) -> Callable[[List[Any]], Any]:
    if isinstance(node, LiteralNode):
        v = node.value
        return lambda sources: v

    if isinstance(node, SourceIndexNode):
        idx = node.index
        def _get_source(sources):
            if idx < 0 or idx >= len(sources):
                return None
            return sources[idx]
        return _get_source

    if isinstance(node, CallNode):
        if node.name not in SAFE_FUNCTIONS:
            raise ValueError(
                f"Function '{node.name}' is not allowed. "
                f"Allowed: {sorted(SAFE_FUNCTIONS.keys())}"
            )
        fn = SAFE_FUNCTIONS[node.name]
        arg_compilers = [_compile_node(a) for a in node.args]

        def _call(sources):
            args = [c(sources) for c in arg_compilers]
            return fn(*args)

        return _call

    raise ValueError(f"Unknown AST node: {type(node).__name__}")


def compile_dsl(expression: str) -> Callable[[List[Any]], Any]:
    """
    Compile a DSL expression into a callable that accepts a list of
    source values and returns one output value.
    """
    tokens = _tokenize(expression)
    parser = _Parser(tokens)
    ast = parser.parse()
    return _compile_node(ast)


def validate_dsl_expression(expression: str) -> None:
    """
    Raise ValueError if the expression cannot be compiled.

    Cheap compile-only check — used by the create/update service.
    """
    if not expression.strip():
        raise ValueError("Expression is empty")
    compile_dsl(expression)


# ═══════════════════════════════════════════════════════════════
# Runtime dispatch for CUSTOM_DSL transforms
# ═══════════════════════════════════════════════════════════════
_CACHE: Dict[str, Callable[[List[Any]], Any]] = {}


def run_custom_dsl(
    expression: str, source_values: List[Any]
) -> Any:
    """Execute a custom DSL expression against the given source values."""
    fn = _CACHE.get(expression)
    if fn is None:
        fn = compile_dsl(expression)
        _CACHE[expression] = fn
    return fn(source_values)