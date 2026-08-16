type ApiResponse = {
  status(code: number): ApiResponse;
  json(body: unknown): void;
};

export default function handler(_req: unknown, res: ApiResponse) {
  res.status(200).json({ service: "natalia-pilot-preview", status: "ready" });
}
