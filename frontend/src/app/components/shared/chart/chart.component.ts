import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container">
      <canvas #chartCanvas></canvas>
    </div>
  `,
  styles: [`
    .chart-container {
      width: 100%;
      height: 100%;
      position: relative;
    }

    canvas {
      width: 100%;
      height: 100%;
    }
  `]
})
export class ChartComponent implements OnInit, OnChanges {
  @Input() type: 'line' | 'bar' = 'line';
  @Input() data: { labels: string[], datasets: any[] } = { labels: [], datasets: [] };
  @Input() options: any = {};
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;

  ngOnInit() {
    this.drawChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] || changes['type']) {
      this.drawChart();
    }
  }

  private drawChart() {
    if (!this.canvasRef?.nativeElement) return;

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    // Set canvas size
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight || 300;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.type === 'line') {
      this.drawLineChart();
    } else if (this.type === 'bar') {
      this.drawBarChart();
    }
  }

  private drawLineChart() {
    if (!this.ctx || !this.data.labels.length) return;

    const canvas = this.ctx.canvas;
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;

    // Draw axes
    if (this.ctx) {
      this.ctx.strokeStyle = '#2D3748';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(padding, padding);
      this.ctx.lineTo(padding, canvas.height - padding);
      this.ctx.lineTo(canvas.width - padding, canvas.height - padding);
      this.ctx.stroke();
    }

    // Draw data
    if (this.data.datasets.length > 0) {
      const dataset = this.data.datasets[0];
      const values = dataset.data;
      const maxValue = Math.max(...values, 100);
      const minValue = Math.min(...values, 0);

      if (!this.ctx) return;
      
      this.ctx.strokeStyle = dataset.borderColor || '#4F46E5';
      this.ctx.fillStyle = dataset.backgroundColor || '#4F46E5';
      this.ctx.lineWidth = 2;

      if (this.ctx) {
        this.ctx.beginPath();
        values.forEach((value: number, index: number) => {
          const x = padding + (index / (values.length - 1 || 1)) * chartWidth;
          const y = canvas.height - padding - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight;
          
          if (index === 0) {
            this.ctx!.moveTo(x, y);
          } else {
            this.ctx!.lineTo(x, y);
          }
        });
        this.ctx.stroke();
      }

      // Fill area
      if (this.ctx) {
        this.ctx.lineTo(canvas.width - padding, canvas.height - padding);
        this.ctx.lineTo(padding, canvas.height - padding);
        this.ctx.closePath();
        this.ctx.globalAlpha = 0.2;
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
      }

      // Draw points
      if (this.ctx) {
        values.forEach((value: number, index: number) => {
          const x = padding + (index / (values.length - 1 || 1)) * chartWidth;
          const y = canvas.height - padding - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight;
          
          if (this.ctx) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, Math.PI * 2);
            this.ctx.fill();
          }
        });
      }
    }

    // Draw labels
    if (this.ctx) {
      this.ctx.fillStyle = '#9BA1B3';
      this.ctx.font = '12px Inter';
      this.ctx.textAlign = 'center';
      this.data.labels.forEach((label, index) => {
        const x = padding + (index / (this.data.labels.length - 1 || 1)) * chartWidth;
        this.ctx!.fillText(label, x, canvas.height - padding + 20);
      });
    }
  }

  private drawBarChart() {
    if (!this.ctx || !this.data.labels.length) return;

    const canvas = this.ctx.canvas;
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;

    // Draw axes
    if (this.ctx) {
      this.ctx.strokeStyle = '#2D3748';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(padding, padding);
      this.ctx.lineTo(padding, canvas.height - padding);
      this.ctx.lineTo(canvas.width - padding, canvas.height - padding);
      this.ctx.stroke();
    }

    // Draw bars
    if (this.data.datasets.length > 0) {
      const dataset = this.data.datasets[0];
      const values = dataset.data;
      const maxValue = Math.max(...values, 100);
      const barWidth = chartWidth / values.length * 0.6;
      const barSpacing = chartWidth / values.length;

      if (this.ctx) {
        values.forEach((value: number, index: number) => {
          const x = padding + index * barSpacing + (barSpacing - barWidth) / 2;
          const barHeight = (value / maxValue) * chartHeight;
          const y = canvas.height - padding - barHeight;

          if (this.ctx) {
            this.ctx.fillStyle = dataset.backgroundColor?.[index] || dataset.backgroundColor || '#4F46E5';
            this.ctx.fillRect(x, y, barWidth, barHeight);
          }
        });
      }
    }

    // Draw labels
    if (this.ctx) {
      this.ctx.fillStyle = '#9BA1B3';
      this.ctx.font = '12px Inter';
      this.ctx.textAlign = 'center';
      this.data.labels.forEach((label, index) => {
        const x = padding + (index + 0.5) * (chartWidth / this.data.labels.length);
        this.ctx!.fillText(label, x, canvas.height - padding + 20);
      });
    }
  }
}

