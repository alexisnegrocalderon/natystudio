# Diagnóstico de assets del hero

El PNG generado para el logotipo incluía un damero dibujado, no transparencia real. La primera corrección determinista recuperó un canal alfa, pero la revisión visual mostró residuos grises dentro y alrededor del logotipo. La corrección final usa el logo fuente sobre fondo negro únicamente como **máscara de luminancia** para una capa rosada CSS; el negro se vuelve transparente por definición y los trazos claros del logo conservan su forma sin cargar el damero defectuoso.
