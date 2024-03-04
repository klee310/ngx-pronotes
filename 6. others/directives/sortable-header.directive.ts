import { Directive, EventEmitter, Input, Output } from "@angular/core";

// https://stackblitz.com/run?file=src%2Fapp%2Ftable-sortable.ts
// custom directive "sortable" for the th (table-head) element - allow the column header to be clicked, emitting the itemClicked event and assigns associated style-classes to the element based on direction
@Directive({
	selector: 'th[sortable]',
	host: {
		'[class.asc]': 'direction === "asc"',
		'[class.desc]': 'direction === "desc"',
    '[class.no-sort]': 'direction === ""',
		'(click)': 'onClick($event)',
	},
})
export class SortableHeader {
	@Input() sortable: string = '';
	@Input() direction: 'asc' | 'desc' | '' = '';
  @Output() itemClicked = new EventEmitter<any>();
  onClick(event: MouseEvent) { event.preventDefault(); this.itemClicked.emit(this); }
}
